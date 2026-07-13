/**
 * Build a curated ≤10k Lichess puzzle package for offline AnyChess use.
 *
 * Source (CC0): https://database.lichess.org/#puzzles
 *   https://database.lichess.org/lichess_db_puzzle.csv.zst
 *
 * Usage (from artifacts/mobile):
 *   node scripts/build-puzzle-dataset.mjs
 *   node scripts/build-puzzle-dataset.mjs --input path/to/lichess_db_puzzle.csv.zst
 *   node scripts/build-puzzle-dataset.mjs --input path/to/lichess_db_puzzle.csv
 *
 * Streams the CSV (optionally zstd-compressed). Never loads the full DB in RAM.
 * Writes:
 *   lib/puzzles/data/manifest.json
 *   lib/puzzles/data/puzzles.json   (array of LocalPuzzle, ≤10_000)
 *   lib/puzzles/data/build-report.json
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { PUZZLE_BUILD_CONFIG as CFG } from './puzzle-config.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'lib', 'puzzles', 'data');
const cacheDir = path.join(__dirname, '.cache');

// ── Tiny seeded RNG (mulberry32) ────────────────────────────────────────────
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseArgs(argv) {
  const out = { input: null, download: true };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--input') out.input = argv[++i];
    if (argv[i] === '--no-download') out.download = false;
  }
  return out;
}

function parseCsvLine(line) {
  // Lichess puzzle CSV is simple: no embedded commas in quoted fields that matter
  // for our used columns. OpeningTags may be empty. Themes are space-separated
  // inside one field — fields themselves are comma-separated without quotes usually.
  // Some FENs contain no commas. Moves are space-separated UCIs in one field.
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

function pieceCount(fen) {
  const board = fen.split(' ')[0];
  let n = 0;
  for (const ch of board) {
    if (/[pnbrqkPNBRQK]/.test(ch)) n += 1;
  }
  return n;
}

function isEligible(row) {
  const rating = Number(row.Rating);
  const rd = Number(row.RatingDeviation);
  const pop = Number(row.Popularity);
  const plays = Number(row.NbPlays);
  if (!Number.isFinite(rating) || rating < CFG.minRating || rating > CFG.maxRating) return false;
  if (!Number.isFinite(rd) || rd > CFG.ratingDeviationMax) return false;
  if (!Number.isFinite(pop) || pop < CFG.popularityMin) return false;
  if (!Number.isFinite(plays) || plays < CFG.nbPlaysMin) return false;
  if (!row.FEN || !row.Moves) return false;
  const moves = row.Moves.trim().split(/\s+/).filter(Boolean);
  // Need setup move + at least one user move.
  if (moves.length < 2) return false;
  // Reject odd-length? Lichess lines can end on user or opponent — OK as long as ≥2.
  try {
    // Light FEN sanity: 6 space-separated fields typical.
    if (row.FEN.split(' ').length < 4) return false;
  } catch {
    return false;
  }
  return true;
}

function toLocal(row) {
  const moves = row.Moves.trim().split(/\s+/).filter(Boolean);
  const themes = (row.Themes || '').trim().split(/\s+/).filter(Boolean);
  const openingTags = (row.OpeningTags || '').trim().split(/\s+/).filter(Boolean);
  return {
    id: row.PuzzleId,
    fen: row.FEN,
    moves,
    rating: Number(row.Rating),
    popularity: Number(row.Popularity),
    themes,
    ...(openingTags.length ? { openingTags } : {}),
    _pieceCount: pieceCount(row.FEN),
  };
}

function primaryBucket(themes) {
  for (const t of CFG.themeBuckets) {
    if (themes.includes(t)) return t;
  }
  return '_other';
}

async function ensureInput(args) {
  if (args.input) return path.resolve(args.input);

  fs.mkdirSync(cacheDir, { recursive: true });
  const zstPath = path.join(cacheDir, 'lichess_db_puzzle.csv.zst');
  if (fs.existsSync(zstPath) && fs.statSync(zstPath).size > 1_000_000) {
    console.log(`Using cached ${zstPath}`);
    return zstPath;
  }
  if (!args.download) {
    throw new Error('No --input and --no-download set.');
  }
  console.log(`Downloading ${CFG.sourceUrl} …`);
  const res = await fetch(CFG.sourceUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(zstPath, buf);
  console.log(`Saved ${zstPath} (${Math.round(buf.length / 1e6)} MB)`);
  return zstPath;
}

async function openLineStream(filePath) {
  const lower = filePath.toLowerCase();
  let stream;
  if (lower.endsWith('.zst')) {
    let fzstd;
    try {
      fzstd = require('./vendor/fzstd/index.cjs');
    } catch {
      fzstd = require('./vendor/fzstd');
    }
    // fzstd decompresses whole buffer — for multi-GB files this is bad.
    // Prefer streaming via fzstd.Decompress if available.
    if (typeof fzstd.decompress === 'function' && fs.statSync(filePath).size < 800_000_000) {
      console.log('Decompressing zst into memory (may take a while)…');
      const compressed = fs.readFileSync(filePath);
      const decompressed = Buffer.from(fzstd.decompress(compressed));
      stream = Readable.from([decompressed]);
    } else {
      throw new Error(
        'zstd streaming unavailable for this file size. Decompress externally with `zstd -d` and pass --input file.csv',
      );
    }
  } else if (lower.endsWith('.gz')) {
    stream = fs.createReadStream(filePath).pipe(createGunzip());
  } else {
    stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  }
  return readline.createInterface({ input: stream, crlfDelay: Infinity });
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = await ensureInput(args);
  const rng = mulberry32(CFG.selectionSeed);

  /** @type {Map<string, any[]>} */
  const buckets = new Map();
  for (const t of [...CFG.themeBuckets, '_other']) buckets.set(t, []);

  let scanned = 0;
  let eligible = 0;
  let header = null;

  const rl = await openLineStream(inputPath);
  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }
    scanned += 1;
    if (scanned % 200_000 === 0) console.log(`… scanned ${scanned} rows, eligible ${eligible}`);

    const cols = parseCsvLine(line);
    if (cols.length < 8) continue;
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cols[i] ?? '';
    if (!isEligible(row)) continue;
    eligible += 1;

    const local = toLocal(row);
    const bucket = primaryBucket(local.themes);
    buckets.get(bucket).push(local);
  }

  console.log(`Scanned ${scanned}, eligible ${eligible}`);

  // Soft per-theme cap.
  const softCap = Math.max(50, Math.floor(CFG.maxPuzzles * CFG.maxSharePerTheme));
  const selected = [];
  const themeCounts = {};

  for (const [theme, list] of buckets) {
    shuffleInPlace(list, rng);
    const take = Math.min(list.length, softCap);
    for (let i = 0; i < take; i++) selected.push(list[i]);
    themeCounts[theme] = take;
  }

  // If under max, fill from remaining eligible across buckets.
  if (selected.length < CFG.maxPuzzles) {
    const leftovers = [];
    for (const [theme, list] of buckets) {
      for (let i = themeCounts[theme] || 0; i < list.length; i++) leftovers.push(list[i]);
    }
    shuffleInPlace(leftovers, rng);
    for (const p of leftovers) {
      if (selected.length >= CFG.maxPuzzles) break;
      selected.push(p);
    }
  }

  shuffleInPlace(selected, rng);
  const finalList = selected.slice(0, CFG.maxPuzzles).map(({ _pieceCount, ...rest }) => rest);

  // Theme distribution (count puzzles that include each theme).
  const dist = {};
  for (const p of finalList) {
    for (const t of p.themes) {
      dist[t] = (dist[t] || 0) + 1;
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  const puzzlesPath = path.join(outDir, 'puzzles.json');
  fs.writeFileSync(puzzlesPath, JSON.stringify(finalList));
  const sizeBytes = fs.statSync(puzzlesPath).size;

  const manifest = {
    version: 1,
    sourceUrl: CFG.sourceUrl,
    license: CFG.sourceLicense,
    seed: CFG.selectionSeed,
    selectionSeed: CFG.selectionSeed,
    ratingMin: CFG.minRating,
    ratingMax: CFG.maxRating,
    minRating: CFG.minRating,
    maxRating: CFG.maxRating,
    filters: {
      popularityMin: CFG.popularityMin,
      nbPlaysMin: CFG.nbPlaysMin,
      ratingDeviationMax: CFG.ratingDeviationMax,
    },
    count: finalList.length,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const report = {
    ...manifest,
    scanned,
    eligible,
    sizeBytes,
    sizeKB: Math.round(sizeBytes / 1024),
    themeDistribution: Object.fromEntries(
      Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 40),
    ),
  };
  fs.writeFileSync(path.join(outDir, 'build-report.json'), JSON.stringify(report, null, 2));

  console.log(`Wrote ${finalList.length} puzzles → ${puzzlesPath} (${report.sizeKB} KB)`);
  console.log('Top themes:', report.themeDistribution);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
