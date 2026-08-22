/**
 * Streaming text lines — .zst via cached decompressed CSV on disk.
 */
import {
  createReadStream,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { decompress } from 'fzstd';
import { basename } from 'node:path';

export async function* streamTextLines(path: string): AsyncGenerator<string> {
  const csvPath =
    path.endsWith('.zst') || path.endsWith('.zstd')
      ? ensureDecompressedCsv(path)
      : path;

  const stream = createReadStream(csvPath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    yield line;
  }
}

function csvCachePath(zstPath: string): string {
  if (/\.csv\.zst(d)?$/i.test(zstPath)) {
    return zstPath.replace(/\.zst(d)?$/i, '');
  }
  return `${zstPath.replace(/\.zst(d)?$/i, '')}.csv`;
}

function ensureDecompressedCsv(zstPath: string): string {
  const csvPath = csvCachePath(zstPath);
  if (existsSync(csvPath)) return csvPath;

  console.error(`Decompressing ${basename(zstPath)} → ${basename(csvPath)} (one-time)…`);
  const compressed = readFileSync(zstPath);
  const decompressed = decompress(compressed);
  writeFileSync(csvPath, Buffer.from(decompressed));
  console.error(`Decompressed ${(decompressed.length / 1e6).toFixed(0)} MB → ${csvPath}`);
  return csvPath;
}
