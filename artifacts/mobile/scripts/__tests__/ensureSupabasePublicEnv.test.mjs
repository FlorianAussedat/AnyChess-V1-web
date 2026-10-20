import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANON_KEY,
  PUBLIC_URL,
  URL_KEY,
  isForbiddenPublicKey,
  jwtRole,
  pickPublicKey,
  publicPairFromEnvText,
  recoveredPublicPair,
  redact,
  selectPublicSupabaseSource,
  upsertPublicEnv,
} from '../ensure-supabase-public-env.mjs';

const ANON_JWT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  Buffer.from(JSON.stringify({ role: 'anon', ref: 'zqfxnzwtptepulmgpxhb' })).toString('base64url'),
  'signature',
].join('.');

const SERVICE_JWT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  Buffer.from(JSON.stringify({ role: 'service_role', ref: 'zqfxnzwtptepulmgpxhb' })).toString('base64url'),
  'signature',
].join('.');

test('pickPublicKey keeps the anon key and drops service_role', () => {
  const picked = pickPublicKey([
    { name: 'service_role', api_key: SERVICE_JWT, type: 'legacy' },
    { name: 'anon', api_key: ANON_JWT, type: 'legacy' },
  ]);
  assert.equal(picked?.name, 'anon');
  assert.equal(picked?.value, ANON_JWT);
  assert.equal(jwtRole(picked?.value), 'anon');
  assert.equal(isForbiddenPublicKey('service_role', SERVICE_JWT), true);
  assert.equal(isForbiddenPublicKey('anon', ANON_JWT), false);
});

test('pickPublicKey accepts a publishable key when no legacy anon key is listed', () => {
  const picked = pickPublicKey([
    { name: 'service_role', api_key: 'sb_secret_do_not_use' },
    { name: 'default', api_key: 'sb_publishable_public_example', type: 'publishable' },
  ]);
  assert.equal(picked?.value, 'sb_publishable_public_example');
});

test('pickPublicKey rejects an anon key for another project', () => {
  const other = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    Buffer.from(JSON.stringify({ role: 'anon', ref: 'otherproject' })).toString('base64url'),
    'signature',
  ].join('.');
  assert.equal(pickPublicKey([{ name: 'anon', api_key: other }]), null);
});

test('upsertPublicEnv preserves unrelated secrets and replaces a forbidden anon slot', () => {
  const before = [
    'DEEPL_API_KEY=keep-this-exact',
    `${URL_KEY}=https://wrong.example`,
    `${ANON_KEY}=${SERVICE_JWT}`,
    'OTHER=1',
    '',
  ].join('\n');
  const next = upsertPublicEnv(before, PUBLIC_URL, ANON_JWT);
  assert.match(next, /DEEPL_API_KEY=keep-this-exact/);
  assert.match(next, new RegExp(`${URL_KEY}=${PUBLIC_URL.replace(/[.]/g, '\\.')}`));
  assert.match(next, new RegExp(`${ANON_KEY}=${ANON_JWT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.equal(next.includes(SERVICE_JWT), false);
  assert.match(next, /^OTHER=1$/m);
  assert.equal(publicPairFromEnvText(next)?.anon, ANON_JWT);
  assert.equal(publicPairFromEnvText(before), null);
});

test('recovered public anon key is the V0.0.6 client key for this project', () => {
  const recovered = recoveredPublicPair();
  assert.equal(recovered?.url, PUBLIC_URL);
  assert.equal(jwtRole(recovered?.anon), 'anon');
  assert.equal(isForbiddenPublicKey(ANON_KEY, recovered?.anon), false);
  assert.equal(recoveredPublicPair(SERVICE_JWT), null);
  const expired = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    Buffer.from(JSON.stringify({ role: 'anon', ref: 'zqfxnzwtptepulmgpxhb', exp: 1 })).toString('base64url'),
    'signature',
  ].join('.');
  assert.equal(recoveredPublicPair(expired), null);
});

test('selectPublicSupabaseSource prefers a local pair and otherwise uses the recovered key', () => {
  const recovered = recoveredPublicPair();
  const local = { url: PUBLIC_URL, anon: ANON_JWT };
  assert.equal(selectPublicSupabaseSource({ fromFile: local, recovered })?.source, 'file');
  assert.equal(selectPublicSupabaseSource({ fromShell: local, recovered })?.source, 'shell');
  assert.equal(
    selectPublicSupabaseSource({ fromApi: { url: PUBLIC_URL, anon: ANON_JWT }, recovered })?.source,
    'api',
  );
  assert.equal(selectPublicSupabaseSource({ recovered })?.source, 'v0.0.6-apk');
  assert.equal(selectPublicSupabaseSource({ recovered: null }), null);
});

test('redact hides jwt and publishable material', () => {
  const hidden = redact(`token ${ANON_JWT} and sb_publishable_abc and sb_secret_def`);
  assert.equal(hidden.includes(ANON_JWT), false);
  assert.equal(hidden.includes('sb_publishable_abc'), false);
  assert.equal(hidden.includes('sb_secret_def'), false);
});
