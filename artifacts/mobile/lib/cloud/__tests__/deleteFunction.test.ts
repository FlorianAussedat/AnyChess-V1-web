import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { transformSync } from 'esbuild';
const source = readFileSync(
  new URL('../../../../../supabase/functions/delete-account/index.ts', import.meta.url),
  'utf8',
);
const code = transformSync(source, { loader: 'ts', format: 'esm' }).code;
function handler(fetchImpl: typeof fetch) {
  let serve!: (request: Request) => Promise<Response>;
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'public-fixture',
    SUPABASE_SERVICE_ROLE_KEY: 'admin-fixture',
  };
  runInNewContext(code, {
    Deno: {
      env: { get: (key: string) => env[key] },
      serve: (callback: typeof serve) => {
        serve = callback;
      },
    },
    fetch: fetchImpl,
    Response,
    Request,
    crypto: webcrypto,
    atob,
    TextEncoder,
    TextDecoder,
    Date,
    Uint8Array,
  });
  return () =>
    serve(
      new Request('https://example.test/delete-account', {
        method: 'POST',
        headers: { Authorization: 'Bearer user-fixture', 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'demo-secret' }),
      }),
    );
}
it('requires password verification before deleting any data', async () => {
  let deletes = 0;
  const call = handler(async (url, init) => {
    if (init?.method === 'DELETE') deletes++;
    if (String(url).includes('grant_type=password'))
      return Response.json({ error: 'invalid_credentials' }, { status: 400 });
    return Response.json({ id: 'A', email: 'a@example.com' });
  });
  const response = await call();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'reauth_failed');
  assert.equal(deletes, 0);
});
it('does not remove the account when avatar cleanup fails', async () => {
  let accountDeletes = 0;
  const call = handler(async (url, init) => {
    const target = String(url);
    if (target.includes('/auth/v1/user')) return Response.json({ id: 'A', email: 'a@example.com' });
    if (target.includes('grant_type=password')) return Response.json({ user: { id: 'A' } });
    if (target.includes('/object/list/')) return Response.json([{ name: 'avatar.png' }]);
    if (target.includes('/object/avatars') && init?.method === 'DELETE')
      return Response.json({ error: 'unavailable' }, { status: 503 });
    accountDeletes++;
    return Response.json({});
  });
  const response = await call();
  assert.equal(response.status, 502);
  assert.equal(accountDeletes, 0);
});
it('confirms deletion only after user and avatar removal are acknowledged', async () => {
  const deletes: string[] = [];
  const call = handler(async (url, init) => {
    const target = String(url);
    if (target.endsWith('/auth/v1/user')) return Response.json({ id: 'A', email: 'a@example.com' });
    if (target.includes('grant_type=password')) return Response.json({ user: { id: 'A' } });
    if (target.includes('/object/list/')) return Response.json([{ name: 'avatar.png' }]);
    if (init?.method === 'DELETE') deletes.push(target);
    return Response.json({});
  });
  const response = await call();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.deepEqual(deletes, [
    'https://example.supabase.co/storage/v1/object/avatars',
    'https://example.supabase.co/auth/v1/admin/users/A',
  ]);
});
it('does not infer that an account disappeared from an expired access token', async () => {
  const call = handler(async () => Response.json({ message: 'JWT expired' }, { status: 401 }));
  const response = await call();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'reauth_required');
});
