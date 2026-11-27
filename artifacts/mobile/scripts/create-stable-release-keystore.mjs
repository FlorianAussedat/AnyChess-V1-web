/**
 * Create the single AnyChess Stable release keystore, once.
 * An existing keystore is kept. Passwords and the private key stay in
 * gitignored files and are never printed.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fingerprintsMatch,
  sha256FromKeytoolOutput,
} from './verify-release-keystore.mjs';

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIGNING_DIR = path.join(MOBILE_ROOT, '.signing');
const STORE_PATH = path.join(SIGNING_DIR, 'anychess-stable-release.jks');
const ENV_PATH = path.join(SIGNING_DIR, 'release.env');
const CERT_PATH = path.join(MOBILE_ROOT, 'signing', 'stable-release-cert.json');
const BACKUP_DIR = path.join(os.homedir(), '.anychess-release');
const BACKUP_STORE = path.join(BACKUP_DIR, 'anychess-stable-release.jks.enc');
const BACKUP_ENV = path.join(BACKUP_DIR, 'release.env.enc');
const BACKUP_PASS = path.join(BACKUP_DIR, 'backup.pass');
const ALIAS = 'anychess-stable';

export function keystoreAction({ storeExists, certExists, sameFingerprint }) {
  if (storeExists && certExists && sameFingerprint) return 'keep';
  if (storeExists && certExists && !sameFingerprint) return 'refuse';
  if (storeExists && !certExists) return 'adopt';
  if (!storeExists && certExists) return 'refuse-missing-store';
  return 'create';
}

function randomSecret() {
  return crypto.randomBytes(24).toString('base64url');
}

function writePrivate(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, text, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

function listSha256(storeFile, storePassword, keyAlias) {
  const result = spawnSync(
    'keytool',
    ['-list', '-v', '-keystore', storeFile, '-storepass', storePassword, '-alias', keyAlias],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error('keytool could not read the stable release keystore');
  }
  const sha = sha256FromKeytoolOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  if (!sha) throw new Error('keytool printed no SHA-256 fingerprint');
  return sha;
}

function readEnvPassword(text) {
  const map = new Map();
  for (const line of String(text ?? '').split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) map.set(match[1], match[2]);
  }
  return {
    storePassword: map.get('ANYCHESS_RELEASE_STORE_PASSWORD') ?? '',
    keyAlias: map.get('ANYCHESS_RELEASE_KEY_ALIAS') ?? ALIAS,
  };
}

function writeCert(sha256) {
  const body = {
    package: 'com.anychess.app',
    alias: ALIAS,
    certSha256: sha256,
    purpose: 'AnyChess Stable release. Public certificate only.',
  };
  fs.writeFileSync(CERT_PATH, `${JSON.stringify(body, null, 2)}\n`);
}

function encryptFile(input, output, passFile) {
  const result = spawnSync(
    'openssl',
    [
      'enc',
      '-aes-256-cbc',
      '-pbkdf2',
      '-iter',
      '200000',
      '-salt',
      '-in',
      input,
      '-out',
      output,
      '-pass',
      `file:${passFile}`,
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error('encrypted backup could not be written');
}

function verifyEncrypted(input, encrypted, passFile) {
  const restored = path.join(os.tmpdir(), `anychess-restore-${crypto.randomBytes(6).toString('hex')}`);
  try {
    const result = spawnSync(
      'openssl',
      ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-in', encrypted, '-out', restored, '-pass', `file:${passFile}`],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) throw new Error('encrypted backup could not be read back');
    const left = fs.readFileSync(input);
    const right = fs.readFileSync(restored);
    if (!left.equals(right)) throw new Error('encrypted backup does not match the keystore');
  } finally {
    fs.rmSync(restored, { force: true });
  }
}

function ensureBackup(storePassword, keyAlias) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  fs.chmodSync(BACKUP_DIR, 0o700);
  if (!fs.existsSync(BACKUP_PASS)) writePrivate(BACKUP_PASS, `${randomSecret()}\n`);
  encryptFile(STORE_PATH, BACKUP_STORE, BACKUP_PASS);
  encryptFile(ENV_PATH, BACKUP_ENV, BACKUP_PASS);
  verifyEncrypted(STORE_PATH, BACKUP_STORE, BACKUP_PASS);
  verifyEncrypted(ENV_PATH, BACKUP_ENV, BACKUP_PASS);
  const copy = path.join(BACKUP_DIR, 'anychess-stable-release.jks');
  fs.copyFileSync(STORE_PATH, copy);
  fs.chmodSync(copy, 0o600);
  fs.chmodSync(BACKUP_STORE, 0o600);
  fs.chmodSync(BACKUP_ENV, 0o600);
  return { storePassword, keyAlias };
}

function createKeystore() {
  // PKCS12 uses one password for the store and the key. A second password
  // makes Gradle fail when it reads the private key.
  const storePassword = randomSecret();
  const keyPassword = storePassword;
  fs.mkdirSync(SIGNING_DIR, { recursive: true, mode: 0o700 });
  const result = spawnSync(
    'keytool',
    [
      '-genkeypair',
      '-keystore',
      STORE_PATH,
      '-storetype',
      'PKCS12',
      '-storepass',
      storePassword,
      '-keypass',
      keyPassword,
      '-alias',
      ALIAS,
      '-dname',
      'CN=AnyChess, OU=AnyChess, O=AnyChess, L=Unknown, ST=Unknown, C=FR',
      '-keyalg',
      'RSA',
      '-keysize',
      '4096',
      '-validity',
      '10000',
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    fs.rmSync(STORE_PATH, { force: true });
    throw new Error('keytool could not create the stable release keystore');
  }
  fs.chmodSync(STORE_PATH, 0o600);
  const env = [
    `ANYCHESS_RELEASE_STORE_FILE=${STORE_PATH}`,
    `ANYCHESS_RELEASE_STORE_PASSWORD=${storePassword}`,
    `ANYCHESS_RELEASE_KEY_ALIAS=${ALIAS}`,
    `ANYCHESS_RELEASE_KEY_PASSWORD=${keyPassword}`,
    '',
  ].join('\n');
  writePrivate(ENV_PATH, env);
  return { storePassword, keyAlias: ALIAS };
}

function main() {
  const storeExists = fs.existsSync(STORE_PATH);
  const certExists = fs.existsSync(CERT_PATH);
  let sameFingerprint = false;
  let secrets = null;
  if (storeExists && certExists && fs.existsSync(ENV_PATH)) {
    const env = readEnvPassword(fs.readFileSync(ENV_PATH, 'utf8'));
    const actual = listSha256(STORE_PATH, env.storePassword, env.keyAlias);
    const recorded = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8')).certSha256;
    sameFingerprint = fingerprintsMatch(actual, recorded);
    secrets = env;
  }
  const action = keystoreAction({ storeExists, certExists, sameFingerprint });
  if (action === 'refuse' || action === 'refuse-missing-store') {
    throw new Error(`stable release keystore action ${action}: existing key was left unchanged`);
  }
  if (action === 'create') {
    secrets = createKeystore();
  } else if (!secrets) {
    throw new Error('existing stable keystore has no gitignored release.env');
  }
  const sha = listSha256(STORE_PATH, secrets.storePassword, secrets.keyAlias);
  if (action === 'adopt' || action === 'create') writeCert(sha);
  else {
    const recorded = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8')).certSha256;
    if (!fingerprintsMatch(sha, recorded)) {
      throw new Error('stable certificate changed while the keystore was being checked');
    }
  }
  ensureBackup(secrets.storePassword, secrets.keyAlias);
  console.log(`[anychess] stable release keystore ${action}; certificate SHA-256 ${sha}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[anychess] ${error instanceof Error ? error.message : 'keystore setup failed'}`);
    process.exitCode = 1;
  }
}
