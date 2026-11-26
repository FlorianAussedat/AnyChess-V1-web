import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../../');

function startConfirmHost(env: NodeJS.ProcessEnv): Promise<{ port: number; stop: () => void }> {
  const child = spawn(process.execPath, ['--experimental-strip-types', join(repoRoot, 'artifacts/mobile/server/serve.js')], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`confirm host did not listen: ${buf}`));
    }, 8000);
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const match = buf.match(/port (\d+)/);
      if (!match || match[1] === '0') return;
      clearTimeout(timer);
      resolve({
        port: Number(match[1]),
        stop: () => child.kill(),
      });
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`confirm host exited ${code}: ${buf}`));
    });
  });
}

describe('confirmation page on the existing web host', () => {
  it('serves text/html at /auth/confirm and stays plain text when unconfigured', async () => {
    const baseEnv = {
      ...process.env,
      PORT: '0',
      BASE_PATH: '/',
    };
    const ready = await startConfirmHost({
      ...baseEnv,
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-anon',
      ANYCHESS_SUPABASE_URL: '',
      ANYCHESS_SUPABASE_ANON_KEY: '',
    });
    try {
      const response = await fetch(`http://127.0.0.1:${ready.port}/auth/confirm`);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /text\/html/);
      assert.match(body, /Vérification du lien/);
      assert.match(body, /<form id="recover" hidden="hidden">/);
      assert.doesNotMatch(body, /service_role/);
      const logo = await fetch(`http://127.0.0.1:${ready.port}/brand/anychess-logo.png`);
      assert.equal(logo.status, 200);
      assert.match(logo.headers.get('content-type') ?? '', /image\/png/);
      assert.ok((await logo.arrayBuffer()).byteLength > 1000);
      const home = await fetch(`http://127.0.0.1:${ready.port}/`);
      assert.equal(home.status, 200);
      assert.match(home.headers.get('content-type') ?? '', /text\/html/);
    } finally {
      ready.stop();
    }

    const missing = await startConfirmHost({
      ...baseEnv,
      EXPO_PUBLIC_SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
      ANYCHESS_SUPABASE_URL: '',
      ANYCHESS_SUPABASE_ANON_KEY: '',
    });
    try {
      const response = await fetch(`http://127.0.0.1:${missing.port}/auth/confirm`);
      const body = await response.text();
      assert.equal(response.status, 503);
      assert.match(response.headers.get('content-type') ?? '', /text\/plain/);
      assert.match(body, /n’est pas configurée/);
      assert.doesNotMatch(body, /Adresse confirmée/);
    } finally {
      missing.stop();
    }
  });
});
