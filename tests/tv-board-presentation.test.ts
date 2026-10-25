import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundImageURLs, centerTVWorkspace, fitTVViewport, retryFailedTVImages, waitForImage, waitForTVAssets } from '../src/lib/tv-board-presentation.ts';

test('zoomed art workspace has equal margins and remains centered at every TV density', () => {
  const viewport = { width: 1920, height: 1080 };
  const artScale = ((1920 - 80) / 1920) * 0.65;
  const origin = centerTVWorkspace(viewport, artScale);
  assert.equal(origin.x, 362);
  assert.equal(origin.y, 203.625);
  assert.equal(origin.x, viewport.width - (origin.x + 1920 * artScale));
  assert.equal(origin.y, viewport.height - (origin.y + 1080 * artScale));
  for (const [width, height] of [[960, 540], [1920, 1080], [3840, 2160]]) {
    const fit = fitTVViewport(width, height);
    assert.equal(fit.left + (origin.x + 960 * artScale) * fit.scale, width / 2);
    assert.equal(fit.top + (origin.y + 540 * artScale) * fit.scale, height / 2);
  }
});

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

test('recovery reloads a failed DOM image and leaves loaded or still-loading images alone', async () => {
  let reloads = 0;
  const failed = new TestImage();
  failed.complete = true;
  Object.defineProperty(failed, 'src', {
    get: () => '/photo.jpg',
    set: () => { reloads++; failed.complete = false; },
  });
  const complete = new TestImage();
  complete.complete = true;
  complete.naturalWidth = complete.naturalHeight = 100;
  complete.src = '/loaded.jpg';
  const loading = new TestImage();
  loading.src = '/loading.jpg';
  const root = { querySelectorAll: () => [failed, complete, loading] } as unknown as HTMLElement;
  assert.equal(retryFailedTVImages(root), 1);
  assert.equal(reloads, 1);
  assert.equal(retryFailedTVImages(root), 0);
  const ready = waitForImage(imageElement(failed), new AbortController().signal);
  failed.naturalWidth = failed.naturalHeight = 100;
  failed.complete = true;
  failed.dispatchEvent(new Event('load'));
  await ready;
  assert.equal(retryFailedTVImages(root), 0);
});

test('complete board assets require CSS textures; failed optional fonts use the CSS fallback', async () => {
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
    await assert.doesNotReject(waitForTVAssets(root, new AbortController().signal));
  } finally {
    Object.assign(globalThis, originals);
  }
});
