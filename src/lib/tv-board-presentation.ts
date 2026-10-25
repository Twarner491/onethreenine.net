export const TV_DESIGN_VIEWPORT = { width: 1920, height: 1080 };

/** Keep the art composition independent of Android's logical pixel density. */
export function fitTVViewport(width: number, height: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1920;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1080;
  const scale = Math.min(safeWidth / 1920, safeHeight / 1080);
  return { scale, left: (safeWidth - 1920 * scale) / 2, top: (safeHeight - 1080 * scale) / 2 };
}

export function backgroundImageURLs(value: string): string[] {
  return [...value.matchAll(/url\((?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^)]*))\)/g)]
    .map(match => (match[1] ?? match[2] ?? match[3]).trim());
}

function aborted() { return new DOMException('Asset check cancelled', 'AbortError'); }

export function waitForImage(image: HTMLImageElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
      signal.removeEventListener('abort', cancelled);
    };
    const cancelled = () => { cleanup(); reject(aborted()); };
    const failed = () => { cleanup(); reject(new Error('Board image unavailable')); };
    const loaded = () => {
      if (!image.naturalWidth || !image.naturalHeight) { failed(); return; }
      const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
      decoded.then(() => {
        cleanup();
        if (signal.aborted) reject(aborted()); else resolve();
      }, failed);
    };
    if (signal.aborted) { cancelled(); return; }
    image.addEventListener('load', loaded, { once: true });
    image.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', cancelled, { once: true });
    if (image.complete) loaded();
  });
}

/** Check only assets already used by the rendered board; do not capture partial photos. */
export async function waitForTVAssets(root: HTMLElement, signal: AbortSignal): Promise<void> {
  const images = [...root.querySelectorAll<HTMLImageElement>('img')];
  const backgrounds = new Set<string>();
  for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    for (const url of backgroundImageURLs(getComputedStyle(element).backgroundImage)) backgrounds.add(url);
  }
  for (const url of backgrounds) {
    const image = new Image();
    image.src = url;
    images.push(image);
  }
  await Promise.all([
    ...images.map(image => waitForImage(image, signal)),
    document.fonts.ready.then(() => {
      // FontFaceSet.ready also resolves after failed fonts, so check the actual faces.
      document.fonts.forEach(face => {
        if (face.status === 'error') throw new Error('Board font unavailable');
      });
    }),
  ]);
  if (signal.aborted) throw aborted();
}
