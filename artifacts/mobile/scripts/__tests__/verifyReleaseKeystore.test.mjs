import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  applySigningEnv,
  fingerprintsMatch,
  loadExpectedCertificate,
  sha256FromKeytoolOutput,
  verifyReleaseKeystore,
} from '../verify-release-keystore.mjs';

const expected = loadExpectedCertificate();

test('expected standalone certificate is the V0.0.6 public fingerprint', () => {
  assert.equal(expected.package, 'com.anychess.standalone');
  assert.equal(expected.versionCode, 1);
  assert.equal(
    fingerprintsMatch(
      expected.certSha256,
      'cbdf1c90eefab09180be477390f99906241aaede1f48962ab8e9416afd4ce7aa',
    ),
    true,
  );
  assert.equal(fingerprintsMatch(expected.certSha256, 'FA:C6:17:45:DC:09:03:78'), false);
});

test('signing env file fills only missing variables', () => {
  const env = { ANYCHESS_RELEASE_KEY_ALIAS: 'kept' };
  applySigningEnv(
    [
      '# comment',
      'ANYCHESS_RELEASE_STORE_FILE=/keys/original.jks',
      'ANYCHESS_RELEASE_KEY_ALIAS=ignored',
      '',
    ].join('\n'),
    env,
  );
  assert.equal(env.ANYCHESS_RELEASE_STORE_FILE, '/keys/original.jks');
  assert.equal(env.ANYCHESS_RELEASE_KEY_ALIAS, 'kept');
});

test('verify refuses a missing keystore and a different certificate', () => {
  const missing = verifyReleaseKeystore({ env: {}, expected });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'missing');
  assert.equal(missing.message.includes(expected.certSha256), true);

  const mismatch = verifyReleaseKeystore({
    env: {
      ANYCHESS_RELEASE_STORE_FILE: '/tmp/other.jks',
      ANYCHESS_RELEASE_STORE_PASSWORD: 'secret-value',
      ANYCHESS_RELEASE_KEY_ALIAS: 'other',
    },
    expected,
    exists: () => true,
    listCert: () => 'SHA256: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF',
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, 'mismatch');
  assert.equal(mismatch.message.includes('secret-value'), false);
});

test('verify accepts only the recorded certificate', () => {
  const listed = `Certificate fingerprints:\n\t SHA256: ${expected.certSha256}\n`;
  assert.equal(sha256FromKeytoolOutput(listed), expected.certSha256);
  const match = verifyReleaseKeystore({
    env: {
      ANYCHESS_RELEASE_STORE_FILE: '/tmp/original.jks',
      ANYCHESS_RELEASE_STORE_PASSWORD: 'secret-value',
      ANYCHESS_RELEASE_KEY_ALIAS: 'anychess',
    },
    expected,
    exists: () => true,
    listCert: () => listed,
  });
  assert.equal(match.ok, true);
  assert.equal(match.message.includes('secret-value'), false);
});

test('a newly generated keystore does not match the installed certificate', () => {
  const keytool = spawnSync('keytool', ['-help'], { encoding: 'utf8' });
  if (keytool.error) return;
  const dir = mkdtempSync(join(tmpdir(), 'anychess-keystore-'));
  const storeFile = join(dir, 'fresh.jks');
  try {
    const created = spawnSync(
      'keytool',
      [
        '-genkeypair',
        '-keystore',
        storeFile,
        '-storepass',
        'temporary',
        '-keypass',
        'temporary',
        '-alias',
        'fresh',
        '-dname',
        'CN=Fresh',
        '-keyalg',
        'RSA',
        '-keysize',
        '2048',
        '-validity',
        '1',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(created.status, 0, created.stderr);
    const result = verifyReleaseKeystore({
      env: {
        ANYCHESS_RELEASE_STORE_FILE: storeFile,
        ANYCHESS_RELEASE_STORE_PASSWORD: 'temporary',
        ANYCHESS_RELEASE_KEY_ALIAS: 'fresh',
      },
      expected,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'mismatch');
    assert.equal(result.message.includes('temporary'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('release signing plugin asks for the original certificate before injecting a keystore', () => {
  const plugin = readFileSync(new URL('../../plugins/withReleaseSigning.js', import.meta.url), 'utf8');
  assert.match(plugin, /verify-release-keystore\.mjs/);
  assert.match(plugin, /assertOriginalReleaseCertificate\(\)/);
});
