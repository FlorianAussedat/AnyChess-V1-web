/**
 * Compare a candidate release keystore with the public certificate of the
 * installed com.anychess.standalone APK. A different certificate cannot
 * update that app. This script never creates a keystore and never prints
 * store or key passwords.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STANDALONE_CERT_PATH = path.join(MOBILE_ROOT, 'signing', 'standalone-release-cert.json');
const STABLE_CERT_PATH = path.join(MOBILE_ROOT, 'signing', 'stable-release-cert.json');
const SIGNING_ENV_PATH = path.join(MOBILE_ROOT, '.signing', 'release.env');

/** Public Expo / React Native debug certificate. It must never sign Stable. */
export const DEBUG_CERT_SHA256 =
  'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';

export function certificatePathForVariant(variant = process.env.ANYCHESS_VARIANT) {
  if (variant === 'standalone') return STANDALONE_CERT_PATH;
  if (variant === 'stable') return STABLE_CERT_PATH;
  throw new Error('Release certificate check requires ANYCHESS_VARIANT=stable or standalone');
}

export function normalizeSha256(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^0-9A-F]/g, '');
}

export function fingerprintsMatch(actual, expected) {
  const left = normalizeSha256(actual);
  const right = normalizeSha256(expected);
  return left.length === 64 && left === right;
}

export function sha256FromKeytoolOutput(text) {
  const match = String(text ?? '').match(/SHA256:\s*([0-9A-Fa-f:]+)/);
  return match ? match[1].toUpperCase() : null;
}

export function loadExpectedCertificate(text, variant = process.env.ANYCHESS_VARIANT || 'stable') {
  const raw = text ?? fs.readFileSync(certificatePathForVariant(variant), 'utf8');
  const cert = JSON.parse(raw);
  if (normalizeSha256(cert.certSha256).length !== 64) {
    throw new Error('release certificate file has no usable certSha256');
  }
  if (fingerprintsMatch(cert.certSha256, DEBUG_CERT_SHA256)) {
    throw new Error('release certificate file records the public debug certificate');
  }
  const expectedPackage = variant === 'standalone' ? 'com.anychess.standalone' : 'com.anychess.app';
  if (cert.package !== expectedPackage) {
    throw new Error(`release certificate package is not ${expectedPackage}`);
  }
  return cert;
}

export function applySigningEnv(text, env) {
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    if (!env[match[1]]) env[match[1]] = match[2];
  }
  return env;
}

export function loadGitignoredSigningEnv(env = process.env, file = SIGNING_ENV_PATH) {
  if (!fs.existsSync(file)) return env;
  return applySigningEnv(fs.readFileSync(file, 'utf8'), env);
}

function redactSecrets(text, secrets) {
  let out = String(text ?? '');
  for (const secret of secrets) {
    if (secret && secret.length >= 4) out = out.split(secret).join('[redacted]');
  }
  return out;
}

export function listCertificate(signing, runner = keytoolList) {
  return runner(signing);
}

function keytoolList({ storeFile, storePassword, keyAlias }) {
  const result = spawnSync(
    'keytool',
    ['-list', '-v', '-keystore', storeFile, '-storepass', storePassword, '-alias', keyAlias],
    { encoding: 'utf8' },
  );
  const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.status !== 0) {
    throw new Error(
      `keytool failed: ${redactSecrets(combined, [storePassword]).replace(/\s+/g, ' ').trim().slice(0, 240)}`,
    );
  }
  return combined;
}

export function verifyReleaseKeystore({
  env = process.env,
  expected = loadExpectedCertificate(),
  listCert = listCertificate,
  exists = fs.existsSync,
} = {}) {
  const storeFile = (env.ANYCHESS_RELEASE_STORE_FILE ?? '').trim();
  const storePassword = env.ANYCHESS_RELEASE_STORE_PASSWORD ?? '';
  const keyAlias = (env.ANYCHESS_RELEASE_KEY_ALIAS ?? '').trim();
  const expectedSha = expected.certSha256;
  if (!storeFile || !storePassword || !keyAlias) {
    return {
      ok: false,
      code: 'missing',
      message:
        `[anychess] standalone release keystore is not configured. Expected certificate SHA-256 ${expectedSha}. ` +
        'Set ANYCHESS_RELEASE_STORE_FILE, ANYCHESS_RELEASE_STORE_PASSWORD and ANYCHESS_RELEASE_KEY_ALIAS ' +
        'from the original keystore. A newly generated keystore is refused.',
    };
  }
  if (!exists(storeFile)) {
    return {
      ok: false,
      code: 'absent',
      message:
        `[anychess] release keystore file is absent. Expected certificate SHA-256 ${expectedSha}. ` +
        'The original private key cannot be rebuilt from the APK.',
    };
  }
  let output;
  try {
    output = listCert({ storeFile, storePassword, keyAlias });
  } catch (error) {
    return {
      ok: false,
      code: 'unreadable',
      message: redactSecrets(error instanceof Error ? error.message : String(error), [storePassword]),
    };
  }
  const actual = sha256FromKeytoolOutput(output);
  if (!actual) {
    return {
      ok: false,
      code: 'unreadable',
      message: '[anychess] keytool listed the keystore but printed no SHA-256 certificate fingerprint.',
    };
  }
  if (fingerprintsMatch(actual, DEBUG_CERT_SHA256)) {
    return {
      ok: false,
      code: 'debug-refused',
      message:
        `[anychess] the keystore is the public debug certificate ${DEBUG_CERT_SHA256}. ` +
        'Stable and standalone release builds refuse it.',
    };
  }
  if (!fingerprintsMatch(actual, expectedSha)) {
    return {
      ok: false,
      code: 'mismatch',
      message:
        `[anychess] keystore certificate SHA-256 ${actual} does not match the installed ` +
        `com.anychess.standalone certificate ${expectedSha}. Refusing to sign.`,
    };
  }
  return { ok: true, code: 'match', sha256: expectedSha, message: `[anychess] release certificate matches ${expectedSha}` };
}

function main() {
  loadGitignoredSigningEnv(process.env);
  const result = verifyReleaseKeystore({
    expected: loadExpectedCertificate(undefined, process.env.ANYCHESS_VARIANT || 'stable'),
  });
  if (!result.ok) {
    console.error(result.message);
    process.exitCode = 1;
    return;
  }
  console.log(result.message);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
