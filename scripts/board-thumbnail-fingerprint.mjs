import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export function thumbnailFingerprint(items, users, renderingSource) {
  const authors = new Set(items.flatMap(item => [item.created_by, item.updated_by]).filter(Boolean));
  return createHash('sha256').update(JSON.stringify(canonicalize({
    renderingSource,
    items,
    users: users.filter(user => authors.has(user.id)),
  }))).digest('hex');
}

async function main() {
  const { SUPABASE_URL, SUPABASE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase URL and public key are required');
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: items, error: itemsError }, { data: users, error: usersError }] = await Promise.all([
    client.from('board_items').select('*').order('created_at').order('id'),
    client.from('users').select('*').order('created_at').order('id'),
  ]);
  if (itemsError || usersError) throw new Error((itemsError ?? usersError).message);

  const source = execFileSync('git', ['ls-files', '--stage', '--', 'src', 'public', 'astro.config.mjs',
    'package-lock.json', '.github/workflows/daily-snapshot.yml',
    ':(exclude)public/assets/images/thumb.png', ':(exclude)public/assets/images/thumb.jpg'],
  { encoding: 'utf8' });
  console.log(thumbnailFingerprint(items, users, source));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
