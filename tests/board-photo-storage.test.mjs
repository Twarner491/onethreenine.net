import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { displayCopy, originalObjectPath, optimizeBoardPhotos, publishDisplay } from '../scripts/optimize-board-photos.mjs';

const origin = 'https://test.supabase.co';
const originalUrl = origin + '/storage/v1/object/public/board-images/u/1.png';

test('only accepts original public objects from the configured Storage project', () => {
  assert.equal(originalObjectPath(originalUrl, origin), 'u/1.png');
  assert.equal(originalObjectPath(originalUrl.replace('test.', 'different.'), origin), null);
  assert.equal(originalObjectPath(originalUrl + '?download', origin), null);
  assert.equal(originalObjectPath(originalUrl.replace('board-images', 'board-display-images'), origin), null);
  assert.equal(originalObjectPath(originalUrl.replace('1.png', '%2e%2e%2fother.png'), origin), null);
});

test('a display copy respects orientation, aspect ratio and transparency', async () => {
  const original = await sharp({ create: { width: 2560, height: 1280, channels: 4, background: '#abc8' } })
    .png().withMetadata({ orientation: 6 }).toBuffer();
  const copy = await displayCopy(original);
  const { width, height, hasAlpha, format } = await sharp(copy).metadata();
  assert.deepEqual({ width, height, hasAlpha, format }, {
    width: 960, height: 1920, hasAlpha: true, format: 'webp',
  });
  assert.ok(copy.length < original.length * 0.8);
});

test('an animated image keeps its original URL', async () => {
  // APNG advertises animation in an acTL chunk before the first IDAT.
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#abc' } }).png().toBuffer();
  const apng = Buffer.concat([
    png.subarray(0, 33), Buffer.from('000000086163544c000000020000000000000000', 'hex'), png.subarray(33),
  ]);
  assert.equal(await displayCopy(apng), null);
});

test('only publishes smaller copies and swaps after publication', async () => {
  const original = await sharp({ create: { width: 2300, height: 1500, channels: 3, background: '#abc' } })
    .png({ compressionLevel: 0 }).toBuffer();
  const small = Buffer.from('tiny');
  const items = [
    { id: 'one', content: { imageUrl: originalUrl } },
    { id: 'two', content: { imageUrl: originalUrl } },
    { id: 'small', content: { imageUrl: originalUrl.replace('1.png', '2.png') } },
    { id: 'external', content: { imageUrl: 'https://elsewhere.test/photo.png' } },
  ];
  const events = [];
  const io = {
    origin,
    async info(path) { return { size: path === 'u/1.png' ? original.length : small.length }; },
    async download(path) { events.push(['download', path]); return original; },
    async publish(path, bytes) {
      assert.ok(bytes.length < original.length * 0.8);
      events.push(['publish', path]);
      return origin + '/storage/v1/object/public/board-display-images/' + path;
    },
    async swap(changes) { events.push(['swap', changes]); return ['one']; },
  };
  const plan = await optimizeBoardPhotos(items, io, false);
  assert.deepEqual(events.map(([event]) => event), ['download']);
  assert.equal(plan.candidates, 2);
  events.length = 0;
  const result = await optimizeBoardPhotos(items, io, true);
  assert.deepEqual(events.map(([event]) => event), ['download', 'publish', 'swap']);
  assert.deepEqual(events[2][1].map(change => [change.item_id, change.expected_url]),
    [['one', originalUrl], ['two', originalUrl]]);
  assert.equal(result.updated, 1);
});

test('a storage failure leaves the row eligible for a safe retry', async () => {
  const original = await sharp({ create: { width: 1000, height: 1000, channels: 3, background: '#abc' } })
    .png({ compressionLevel: 0 }).toBuffer();
  const io = {
    origin,
    async info() { return { size: original.length }; },
    async download() { return original; },
    async publish() { throw new Error('upload unavailable'); },
    async swap() { assert.fail('cannot switch to an unpublished object'); },
  };
  const result = await optimizeBoardPhotos([{ id: 'one', content: { imageUrl: originalUrl } }], io, true);
  assert.equal(result.updated, 0);
  assert.deepEqual(result.errors, [{ item: 'one', message: 'upload unavailable' }]);
});

test('publication verifies the nested public URL returned by the Storage SDK', async () => {
  const expected = origin + '/storage/v1/object/public/board-display-images/u/photo.png/hash.webp';
  const bytes = Buffer.from('smaller image');
  const target = {
    async upload(path, body, options) {
      assert.equal(path, 'u/photo.png/hash.webp');
      assert.equal(body, bytes);
      assert.equal(options.upsert, false);
      return { error: null };
    },
    getPublicUrl() { return { data: { publicUrl: expected } }; },
  };
  const result = await publishDisplay(target, 'u/photo.png/hash.webp', bytes, async (url, options) => {
    assert.equal(url, expected);
    assert.equal(options.method, 'HEAD');
    return new Response(null, { headers: { 'content-length': String(bytes.length), 'content-type': 'image/webp' } });
  });
  assert.equal(result, expected);
});
