/**
 * Ensures artifacts/mobile/.env contains the public Supabase URL and anon key
 * for the existing project. Expo inlines EXPO_PUBLIC_* when Metro bundles.
 *
 * Never writes service_role. Never reads or writes DEEPL_API_KEY.
 * If .env already has a valid public pair, the file is left unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_REF = 'zqfxnzwtptepulmgpxhb';
export const PUBLIC_URL = `https://${PROJECT_REF}.supabase.co`;
export const URL_KEY = 'EXPO_PUBLIC_SUPABASE_URL';
export const ANON_KEY = 'EXPO_PUBLIC_SUPABASE_ANON_KEY';

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(MOBILE_ROOT, '.env');

export function redact(value) {
  return String(value)
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[sb-key]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[token]');
}

export function jwtPayload(token) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

export function jwtRole(token) {
  const role = jwtPayload(token)?.role;
  return typeof role === 'string' ? role : null;
}

export function isForbiddenPublicKey(name, value) {
  const label = String(name ?? '').toLowerCase();
  if (label === 'service_role' || label.includes('service_role') || label === 'secret' || label.includes('secret')) {
    return true;
  }
  if (String(value ?? '').startsWith('sb_secret_')) return true;
  return jwtRole(value) === 'service_role';
}

function isPublishableValue(value) {
  return String(value ?? '').startsWith('sb_publishable_');
}

export function pickPublicKey(keys) {
  const list = Array.isArray(keys) ? keys : keys?.api_keys ?? keys?.keys ?? [];
  const candidates = [];
  for (const item of list) {
    const name = String(item?.name ?? item?.id ?? '');
    const value = String(item?.api_key ?? item?.apiKey ?? '');
    if (!value) continue;
    if (isForbiddenPublicKey(name, value)) continue;
    const role = jwtRole(value);
    const label = name.toLowerCase();
    const legacyAnon = label === 'anon' || role === 'anon';
    const publishable = label.includes('publishable') || isPublishableValue(value);
    if (!legacyAnon && !publishable) continue;
    const payload = jwtPayload(value);
    if (payload?.ref && payload.ref !== PROJECT_REF) continue;
    candidates.push({ name, value, role, publishable });
  }
  return (
    candidates.find((item) => item.role === 'anon' || item.name.toLowerCase() === 'anon') ??
    candidates.find((item) => item.publishable) ??
    null
  );
}

export function readEnvAssignments(text) {
  const map = new Map();
  for (const line of String(text ?? '').split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) map.set(match[1], match[2]);
  }
  return map;
}

export function publicPairFromEnvText(text) {
  const map = readEnvAssignments(text);
  const url = (map.get(URL_KEY) ?? '').trim();
  const anon = (map.get(ANON_KEY) ?? '').trim();
  if (url !== PUBLIC_URL || !anon || isForbiddenPublicKey(ANON_KEY, anon)) return null;
  return { url, anon };
}

/** Replace only the two public keys. Every other line, including DEEPL_API_KEY, stays byte-for-byte. */
export function upsertPublicEnv(text, url, anon) {
  const updates = { [URL_KEY]: url, [ANON_KEY]: anon };
  const seen = new Set();
  const lines = String(text ?? '').split('\n');
  const out = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !Object.prototype.hasOwnProperty.call(updates, match[1])) return line;
    seen.add(match[1]);
    return `${match[1]}=${updates[match[1]]}`;
  });
  let body = out.join('\n');
  for (const key of [URL_KEY, ANON_KEY]) {
    if (seen.has(key)) continue;
    if (body.length > 0 && !body.endsWith('\n')) body += '\n';
    body += `${key}=${updates[key]}\n`;
  }
  if (!body.endsWith('\n')) body += '\n';
  return body;
}

function describeKey(value) {
  const role = jwtRole(value);
  if (role) return `jwt role=${role} length=${value.length}`;
  if (isPublishableValue(value)) return `publishable length=${value.length}`;
  return `public length=${value.length}`;
}

async function fetchApiKeys(token) {
  const endpoint = `https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase api-keys HTTP ${response.status}: ${redact(raw).slice(0, 180)}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Supabase api-keys response was not JSON');
  }
}

function shellPair() {
  const url = (process.env[URL_KEY] ?? process.env.ANYCHESS_SUPABASE_URL ?? '').trim();
  const anon = (process.env[ANON_KEY] ?? process.env.ANYCHESS_SUPABASE_ANON_KEY ?? '').trim();
  if (url !== PUBLIC_URL || !anon || isForbiddenPublicKey(ANON_KEY, anon)) return null;
  return { url, anon };
}

function writeEnv(next) {
  fs.writeFileSync(ENV_PATH, next, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(ENV_PATH, 0o600);
  } catch {
    // mode on write is enough
  }
}

export async function ensureSupabasePublicEnv() {
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const fromFile = publicPairFromEnvText(existing);
  if (fromFile) {
    return { ok: true, source: 'file', ...fromFile };
  }

  const fromShell = shellPair();
  if (fromShell) {
    writeEnv(upsertPublicEnv(existing, fromShell.url, fromShell.anon));
    return { ok: true, source: 'shell', ...fromShell };
  }

  const token = (process.env.SUPABASE_ACCESS_TOKEN ?? '').trim();
  if (!token) {
    return {
      ok: false,
      error:
        'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_ACCESS_TOKEN',
    };
  }

  const picked = pickPublicKey(await fetchApiKeys(token));
  if (!picked) {
    return { ok: false, error: 'No anon or publishable key returned for the existing project' };
  }
  writeEnv(upsertPublicEnv(existing, PUBLIC_URL, picked.value));
  return { ok: true, source: 'api', url: PUBLIC_URL, anon: picked.value, name: picked.name };
}

async function main() {
  try {
    const result = await ensureSupabasePublicEnv();
    if (!result.ok) {
      console.error(`[anychess] ${result.error}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `[anychess] supabase public env ready (host ${PROJECT_REF}.supabase.co, ${describeKey(result.anon)}, source=${result.source})`,
    );
  } catch (error) {
    console.error(`[anychess] ${redact(error instanceof Error ? error.message : String(error))}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
