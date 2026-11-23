import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const originals = 'board-images';
const displays = 'board-display-images';
const minOriginalBytes = 160 * 1024;
const maxOriginalBytes = 10 * 1024 * 1024;

export function originalObjectPath(value, origin) {
  const prefix = '/storage/v1/object/public/' + originals + '/';
  try {
    const url = new URL(value);
    if (url.origin !== origin || url.search || url.hash || !url.pathname.startsWith(prefix)) return null;
    const segments = url.pathname.slice(prefix.length).split('/').map(decodeURIComponent);
    if (segments.some(part => !part || part === '.' || part === '..' || /[/\\%?#]/.test(part))) return null;
    return segments.join('/');
  } catch {
    return null;
  }
}

function isAnimatedPng(bytes) {
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL') return true;
    if (type === 'IDAT') return false;
    offset += bytes.readUInt32BE(offset) + 12;
  }
  return false;
}

export async function displayCopy(bytes) {
  const image = sharp(bytes, { limitInputPixels: 60_000_000 });
  const { format, pages } = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(format) || (pages ?? 1) > 1 ||
      (format === 'png' && isAnimatedPng(bytes))) return null;

  const copy = await image.rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .withIccProfile('srgb')
    .webp({ quality: 86 })
    .toBuffer();
  return copy.length < bytes.length * 0.8 ? copy : null;
}

export async function optimizeBoardPhotos(items, io, apply) {
  const copies = new Map();
  const changes = [];
  const errors = [];
  let originalBytes = 0;
  let displayBytes = 0;

  for (const item of items) {
    const url = item.content?.imageUrl;
    const path = originalObjectPath(url, io.origin);
    if (!path) continue;

    try {
      if (!copies.has(path)) {
        copies.set(path, null);
        const { size, contentType } = await io.info(path);
        if (size < minOriginalBytes || size > maxOriginalBytes ||
            (contentType && !['image/jpeg', 'image/png', 'image/webp'].includes(contentType))) continue;

        const original = await io.download(path);
        const copy = await displayCopy(original);
        if (!copy) continue;
        const hash = createHash('sha256').update(copy).digest('hex');
        const replacement = apply ? await io.publish(path + '/' + hash + '.webp', copy) : null;
        copies.set(path, { originalSize: original.length, displaySize: copy.length, replacement });
      }

      const copy = copies.get(path);
      if (!copy) continue;
      originalBytes += copy.originalSize;
      displayBytes += copy.displaySize;
      changes.push({ item_id: item.id, expected_url: url, display_url: copy.replacement });
    } catch (error) {
      errors.push({ item: item.id, message: error.message });
    }
  }

  const updated = apply && changes.length ? (await io.swap(changes)).length : 0;
  return { candidates: changes.length, updated, originalBytes, displayBytes, errors };
}

function dataOrThrow({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== '--apply')) {
    throw new Error('Usage: node scripts/optimize-board-photos.mjs [--apply]');
  }
  const apply = args[0] === '--apply';
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase URL and service-role credential are required');
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const items = dataOrThrow(await client.from('board_items').select('id,content').eq('type', 'photo').order('id'));
  const source = client.storage.from(originals);
  const target = client.storage.from(displays);
  let bucketReady = false;

  const result = await optimizeBoardPhotos(items, {
    origin: new URL(SUPABASE_URL).origin,
    async info(path) {
      // Use a metadata-only read to avoid downloading images already small enough for the board.
      return dataOrThrow(await source.info(path));
    },
    async download(path) {
      const blob = dataOrThrow(await source.download(path));
      return Buffer.from(await blob.arrayBuffer());
    },
    async publish(path, bytes) {
      if (!bucketReady) {
        const bucket = dataOrThrow(await client.storage.getBucket(displays));
        if (!bucket.public) throw new Error('The display image bucket must serve public reads');
        bucketReady = true;
      }

      const { error } = await target.upload(path, bytes, {
        upsert: false,
        contentType: 'image/webp',
        cacheControl: '31536000',
      });
      // The name is a hash of the exact bytes, and only trusted roles write this bucket.
      if (error && error.statusCode !== '409' && error.statusCode !== '400') throw new Error(error.message);

      const { publicUrl } = target.getPublicUrl(path);
      const response = await fetch(publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(15_000) });
      if (!response.ok || Number(response.headers.get('content-length')) !== bytes.length ||
          response.headers.get('content-type') !== 'image/webp') {
        throw new Error(error?.message ?? 'Could not verify the public display image');
      }
      return publicUrl;
    },
    async swap(changes) {
      return dataOrThrow(await client.rpc('swap_board_photo_urls', { changes }));
    },
  }, apply);

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', activePhotos: items.length, ...result }));
  if (result.errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
