#!/usr/bin/env node
/**
 * Download the official Stockfish 19 Android arm64 binary into module assets.
 * The ~97MB executable is gitignored and fetched at Gradle preBuild.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const moduleRoot = join(here, '..');
const manifest = JSON.parse(
  readFileSync(join(here, 'stockfish-android-manifest.json'), 'utf8'),
);

const cacheDir = join(moduleRoot, '.cache');
const extractDir = join(cacheDir, 'extract');
const assetDir = join(moduleRoot, 'android/src/main/assets/stockfish');
const tarPath = join(cacheDir, manifest.artifact.name);
const destBin = join(assetDir, manifest.assetName);
const destMeta = join(assetDir, 'VERSION.txt');

function sha256File(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function alreadyReady() {
  if (!existsSync(destBin) || !existsSync(destMeta)) return false;
  const meta = readFileSync(destMeta, 'utf8').trim();
  const size = statSync(destBin).size;
  return meta.includes(manifest.tag) && size > 1_000_000;
}

async function main() {
  if (alreadyReady()) {
    console.log(`[stockfish-uci] ${manifest.assetName} already present (${statSync(destBin).size} bytes)`);
    return;
  }

  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(assetDir, { recursive: true });

  let needDownload = true;
  if (existsSync(tarPath)) {
    const actual = await sha256File(tarPath);
    if (actual === manifest.artifact.sha256) {
      needDownload = false;
      console.log('[stockfish-uci] using cached tarball');
    } else {
      console.warn('[stockfish-uci] cached tarball hash mismatch, re-downloading');
      rmSync(tarPath, { force: true });
    }
  }

  if (needDownload) {
    console.log(`[stockfish-uci] downloading ${manifest.artifact.url}`);
    await download(manifest.artifact.url, tarPath);
  }

  const actual = await sha256File(tarPath);
  if (actual !== manifest.artifact.sha256) {
    throw new Error(
      `[stockfish-uci] sha256 mismatch: expected ${manifest.artifact.sha256}, got ${actual}`,
    );
  }

  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  execFileSync('tar', ['-xzf', tarPath, '-C', extractDir, manifest.artifact.binaryMember], {
    stdio: 'inherit',
  });

  const extracted = join(extractDir, manifest.artifact.binaryMember);
  if (!existsSync(extracted)) {
    throw new Error(`[stockfish-uci] missing extracted binary ${extracted}`);
  }

  copyFileSync(extracted, destBin);
  writeFileSync(
    destMeta,
    [
      `engine=${manifest.engine}`,
      `version=${manifest.version}`,
      `tag=${manifest.tag}`,
      `license=${manifest.license}`,
      `abi=${manifest.abi.join(',')}`,
      `sha256=${manifest.artifact.sha256}`,
      `bytes=${statSync(destBin).size}`,
    ].join('\n'),
    'utf8',
  );

  console.log(
    `[stockfish-uci] installed ${destBin} (${statSync(destBin).size} bytes, ${manifest.tag})`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
