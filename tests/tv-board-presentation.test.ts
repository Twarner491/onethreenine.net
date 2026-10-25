import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundImageURLs, fitTVViewport, waitForImage, waitForTVAssets } from '../src/lib/tv-board-presentation.ts';

test('TV composition scales proportionally at logical 960px, 1080p and 4K', () => {
  assert.deepEqual(fitTVViewport(960, 540), { scale: 0.5, left: 0, top: 0 });
  assert.deepEqual(fitTVViewport(1920, 1080), { scale: 1, left: 0, top: 0 });
  assert.deepEqual(fitTVViewport(3840, 2160), { scale: 2, left: 0, top: 0 });
  for (const [width, height] of [[960, 540], [1920, 1080], [3840, 2160]]) {
    const fit = fitTVViewport(width, height);
    assert.equal((fit.left + 1400 * fit.scale) / width, 1400 / 1920);
    assert.equal((fit.top + 700 * fit.scale) / height, 700 / 1080);
  }
});

test('non-16:9 displays contain the full design canvas and invalid sizes are safe', () => {
  assert.deepEqual(fitTVViewport(960, 720), { scale: 0.5, left: 0, top: 90 });
  assert.deepEqual(fitTVViewport(NaN, 0), { scale: 1, left: 0, top: 0 });
});

test('asset inventory includes CSS textures alongside gradients and data SVGs', () => {
  assert.deepEqual(backgroundImageURLs('linear-gradient(red, blue), url("/paper.png"), url(\'/cork.jpg\')'), ['/paper.png', '/cork.jpg']);
  assert.deepEqual(backgroundImageURLs('url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")'), ['data:image/svg+xml,%3Csvg%3E%3C/svg%3E']);
  assert.deepEqual(backgroundImageURLs('none'), []);
});

class TestImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  src = '';
  decode: () => Promise<void> = async () => {};
}
const imageElement = (image: TestImage) => image as unknown as HTMLImageElement;

test('image readiness waits for load and decode, and rejects broken cached images', async () => {
  const image = new TestImage();
  let finish!: () => void;
  image.decode = () => new Promise(resolve => { finish = resolve; });
  let ready = false;
  const waiting = waitForImage(imageElement(image), new AbortController().signal).then(() => { ready = true; });
  image.naturalWidth = 400;
  image.naturalHeight = 300;
  image.dispatchEvent(new Event('load'));
  assert.equal(ready, false);
  finish();
  await waiting;
  assert.equal(ready, true);
  const broken = new TestImage();
  broken.complete = true;
  await assert.rejects(waitForImage(imageElement(broken), new AbortController().signal), /unavailable/);
});

test('a cancelled asset generation cannot report ready after a late decode', async () => {
  const image = new TestImage();
  image.complete = true;
  image.naturalWidth = image.naturalHeight = 1;
  let finish!: () => void;
  image.decode = () => new Promise(resolve => { finish = resolve; });
  const controller = new AbortController();
  const waiting = waitForImage(imageElement(image), controller.signal);
  controller.abort();
  finish();
  await assert.rejects(waiting, { name: 'AbortError' });
});

test('complete board assets require CSS textures and non-failed fonts', async () => {
  const originals = {
    Image: globalThis.Image, document: globalThis.document, getComputedStyle: globalThis.getComputedStyle,
  };
  const requested: TestImage[] = [];
  const faces = [{ status: 'loaded' }];
  class CachedImage extends TestImage {
    constructor() { super(); this.complete = true; this.naturalWidth = this.naturalHeight = 1; requested.push(this); }
  }
  try {
    Object.assign(globalThis, {
      Image: CachedImage,
      document: { fonts: { ready: Promise.resolve(), forEach: (visit: (face: { status: string }) => void) => faces.forEach(visit) } },
      getComputedStyle: () => ({ backgroundImage: 'url("/paper.png"), url("/cork.jpg")' }),
    });
    const root = { querySelectorAll: () => [] } as unknown as HTMLElement;
    await waitForTVAssets(root, new AbortController().signal);
    assert.deepEqual(requested.map(image => image.src), ['/paper.png', '/cork.jpg']);
    faces[0].status = 'error';
    await assert.rejects(waitForTVAssets(root, new AbortController().signal), /font unavailable/);
  } finally {
    Object.assign(globalThis, originals);
  }
});
