import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderConfirmationPage } from '../supabase/functions/auth-confirm/page.ts';
import {
  PUBLIC_LOGO_PATH,
  PUBLIC_SUPABASE_URL,
  PUBLIC_VERIFY_URL,
} from '../supabase/functions/auth-confirm/publicPage.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.CONFIRM_SITE_OUT
  ? join(process.env.CONFIRM_SITE_OUT)
  : join(root, 'dist/confirm-site');

const html = renderConfirmationPage({
  supabaseUrl: PUBLIC_SUPABASE_URL,
  anonKey: '',
  logoUrl: PUBLIC_LOGO_PATH,
  verifyUrl: PUBLIC_VERIFY_URL,
});

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'auth/confirm'), { recursive: true });
await mkdir(join(out, 'brand'), { recursive: true });
await writeFile(join(out, 'auth/confirm/index.html'), html);
await copyFile(
  join(root, 'artifacts/mobile/server/brand/anychess-logo.png'),
  join(out, 'brand/anychess-logo.png'),
);

const allowed = new Set(['auth/confirm/index.html', 'brand/anychess-logo.png']);
const found = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else found.push(relative(out, full).split('\\').join('/'));
  }
}
await walk(out);
found.sort();
const expected = [...allowed].sort();
if (found.join('\n') !== expected.join('\n')) {
  throw new Error(`confirm site contains unexpected files:\n${found.join('\n')}`);
}
if (!html.includes('scheme=anychess;package=com.anychess.standalone')) {
  throw new Error('confirm page is missing the standalone app link');
}
if (html.includes('.svg') || html.includes('jsdelivr')) {
  throw new Error('confirm page still points at the abandoned CDN workaround');
}
console.log(`confirm site: ${out}`);
