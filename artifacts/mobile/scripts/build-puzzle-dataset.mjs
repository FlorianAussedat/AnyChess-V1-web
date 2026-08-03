/**
 * Build a curated multi-Elo Lichess puzzle package for offline AnyChess use.
 *
 * Source (CC0): https://database.lichess.org/#puzzles
 *   https://database.lichess.org/lichess_db_puzzle.csv.zst
 *
 * Usage (from artifacts/mobile):
 *   node scripts/build-puzzle-dataset.mjs
 *   node scripts/build-puzzle-dataset.mjs --input path/to/lichess_db_puzzle.csv.zst
 *   node scripts/build-puzzle-dataset.mjs --input path/to/lichess_db_puzzle.csv
 *
 * Streams the CSV (zstd CLI preferred). Never loads the full DB in RAM.
 * Writes:
 *   lib/puzzles/data/manifest.json
 *   lib/puzzles/data/puzzles.json
 *   lib/puzzles/data/build-report.json
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { Readable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { PUZZLE_BUILD_CONFIG as CFG } from './puzzle-config.mjs';

const require = createRequire(import.meta.url);
const { Chess } = require('chess.js');
const pipelineAsync = promisify(pipeline);
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

function bandForRating(rating) {
  for (const band of CFG.ratingBands) {
    if (rating >= band.min && rating <= band.max) return band;
  }
  return null;
}

function identityKey(fen, moves) {
  return `${fen}|${moves.join(' ')}`;
}

function isEligible(row) {
  const rating = Number(row.Rating);
  const rd = Number(row.RatingDeviation);
  const pop = Number(row.Popularity);
  const plays = Number(row.NbPlays);
  if (!Number.isFinite(rating) || rating < CFG.minRating || rating > CFG.maxRating) {
    return false;
  }
  if (!bandForRating(rating)) return false;
  if (!Number.isFinite(rd) || rd > CFG.ratingDeviationMax) return false;
  if (!Number.isFinite(pop) || pop < CFG.popularityMin) return false;
  if (!Number.isFinite(plays) || plays < CFG.nbPlaysMin) return false;
  if (!row.PuzzleId || !row.FEN || !row.Moves) return false;
  const moves = row.Moves.trim().split(/\s+/).filter(Boolean);
  // Need setup move + at least one user move.
  if (moves.length < 2) return false;
  if (row.FEN.split(' ').length < 4) return false;
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
    _identity: identityKey(row.FEN, moves),
  };
}

function primaryBucket(themes) {
  for (const t of CFG.themeBuckets) {
    if (themes.includes(t)) return t;
  }
  return '_other';
}

/** Validate FEN legality and that every UCI in the solution line is legal. */
function validatePuzzleLine(fen, moves) {
  try {
    const game = new Chess(fen);
    for (const uci of moves) {
      if (!uci || uci.length < 4) return false;
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.slice(4) || undefined;
      const played = game.move({ from, to, promotion });
      if (!played) return false;
    }
    return true;
  } catch {
    return false;
  }
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
  if (!res.body) throw new Error('Download failed: empty body');

  const tmpPath = `${zstPath}.partial`;
  const file = fs.createWriteStream(tmpPath);
  await pipelineAsync(Readable.fromWeb(res.body), file);
  fs.renameSync(tmpPath, zstPath);
  console.log(`Saved ${zstPath} (${Math.round(fs.statSync(zstPath).size / 1e6)} MB)`);
  return zstPath;
}

function hasZstdCli() {
  try {
    const r = spawn('zstd', ['--version'], { stdio: 'ignore' });
    return new Promise((resolve) => {
      r.on('error', () => resolve(false));
      r.on('close', (code) => resolve(code === 0));
    });
  } catch {
    return Promise.resolve(false);
  }
}

async function openLineStream(filePath) {
  const lower = filePath.toLowerCase();
  let stream;
  if (lower.endsWith('.zst')) {
    if (await hasZstdCli()) {
      console.log('Streaming via zstd CLI…');
      const proc = spawn('zstd', ['-dc', filePath], {
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      stream = proc.stdout;
      proc.on('error', (err) => {
        throw err;
      });
    } else {
      let fzstd;
      try {
        fzstd = require('./vendor/fzstd/index.cjs');
      } catch {
        fzstd = require('./vendor/fzstd');
      }
      if (typeof fzstd.decompress === 'function' && fs.statSync(filePath).size < 800_000_000) {
        console.log('Decompressing zst into memory (may take a while)…');
        const compressed = fs.readFileSync(filePath);
        const decompressed = Buffer.from(fzstd.decompress(compressed));
        stream = Readable.from([decompressed]);
      } else {
        throw new Error(
          'zstd streaming unavailable. Install `zstd` or decompress externally and pass --input file.csv',
        );
      }
    }
  } else if (lower.endsWith('.gz')) {
    stream = fs.createReadStream(filePath).pipe(createGunzip());
  } else {
    stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  }
  return readline.createInterface({ input: stream, crlfDelay: Infinity });
}

/**
 * Select up to `target` puzzles from a band's theme-bucketed candidates,
 * balancing themes and validating FEN + solution lines.
 */
function selectForBand(band, themeLists, rng, globalSeenIds, globalSeenIdentity) {
  const softCap = Math.max(
    20,
    Math.floor(band.target * CFG.maxSharePerTheme),
  );
  const selected = [];
  const themeCounts = {};
  let rejectedInvalid = 0;
  let rejectedDup = 0;

  const tryTake = (p) => {
    if (globalSeenIds.has(p.id)) {
      rejectedDup += 1;
      return false;
    }
    if (globalSeenIdentity.has(p._identity)) {
      rejectedDup += 1;
      return false;
    }
    if (!validatePuzzleLine(p.fen, p.moves)) {
      rejectedInvalid += 1;
      return false;
    }
    globalSeenIds.add(p.id);
    globalSeenIdentity.add(p._identity);
    selected.push(p);
    return true;
  };

  // First pass: soft per-theme caps.
  for (const [theme, list] of themeLists) {
    shuffleInPlace(list, rng);
    let taken = 0;
    for (const p of list) {
      if (selected.length >= band.target) break;
      if (taken >= softCap) break;
      if (tryTake(p)) {
        taken += 1;
        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      }
    }
  }

  // Second pass: fill remaining from any not-yet-selected candidates.
  if (selected.length < band.target) {
    const leftovers = [];
    for (const [, list] of themeLists) {
      for (const p of list) {
        if (!globalSeenIds.has(p.id)) leftovers.push(p);
      }
    }
    shuffleInPlace(leftovers, rng);
    for (const p of leftovers) {
      if (selected.length >= band.target) break;
      tryTake(p);
    }
  }

  return {
    selected: selected.slice(0, band.target),
    rejectedInvalid,
    rejectedDup,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = await ensureInput(args);
  const rng = mulberry32(CFG.selectionSeed);

  /** @type {Map<string, Map<string, any[]>>} bandId → theme → candidates */
  const bandThemePools = new Map();
  /** @type {Map<string, number>} */
  const bandCandidateCounts = new Map();
  for (const band of CFG.ratingBands) {
    const themes = new Map();
    for (const t of [...CFG.themeBuckets, '_other']) themes.set(t, []);
    bandThemePools.set(band.id, themes);
    bandCandidateCounts.set(band.id, 0);
  }

  const maxCandidatesPerBand = Math.max(
    ...CFG.ratingBands.map((b) => b.target * CFG.candidateMultiplier),
  );

  // Global scan-level dedupe so candidates themselves are unique.
  const scanSeenIds = new Set();
  const scanSeenIdentity = new Set();

  let scanned = 0;
  let eligible = 0;
  let scanDupes = 0;
  let header = null;

  const rl = await openLineStream(inputPath);
  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }
    scanned += 1;
    if (scanned % 500_000 === 0) {
      const filled = [...bandCandidateCounts.entries()]
        .map(([id, n]) => `${id}:${n}`)
        .join(' ');
      console.log(`… scanned ${scanned}, eligible ${eligible} | ${filled}`);
    }

    const cols = parseCsvLine(line);
    if (cols.length < 8) continue;
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cols[i] ?? '';
    if (!isEligible(row)) continue;

    const local = toLocal(row);
    if (scanSeenIds.has(local.id) || scanSeenIdentity.has(local._identity)) {
      scanDupes += 1;
      continue;
    }

    const band = bandForRating(local.rating);
    if (!band) continue;

    const count = bandCandidateCounts.get(band.id) || 0;
    if (count >= maxCandidatesPerBand) continue;

    eligible += 1;
    scanSeenIds.add(local.id);
    scanSeenIdentity.add(local._identity);

    const theme = primaryBucket(local.themes);
    const themeMap = bandThemePools.get(band.id);
    themeMap.get(theme).push(local);
    bandCandidateCounts.set(band.id, count + 1);
  }

  console.log(`Scanned ${scanned}, eligible candidates ${eligible}, scan dupes skipped ${scanDupes}`);

  const globalSeenIds = new Set();
  const globalSeenIdentity = new Set();
  const finalList = [];
  const perBandCounts = {};
  const perBandThemes = {};
  let totalRejectedInvalid = 0;
  let totalRejectedDup = 0;

  for (const band of CFG.ratingBands) {
    const themeMap = bandThemePools.get(band.id);
    const { selected, rejectedInvalid, rejectedDup } = selectForBand(
      band,
      themeMap,
      rng,
      globalSeenIds,
      globalSeenIdentity,
    );
    totalRejectedInvalid += rejectedInvalid;
    totalRejectedDup += rejectedDup;
    perBandCounts[band.id] = selected.length;

    const themeDist = {};
    for (const p of selected) {
      for (const t of p.themes) themeDist[t] = (themeDist[t] || 0) + 1;
      const { _pieceCount, _identity, ...rest } = p;
      finalList.push(rest);
    }
    perBandThemes[band.id] = Object.fromEntries(
      Object.entries(themeDist).sort((a, b) => b[1] - a[1]).slice(0, 25),
    );
    console.log(
      `Band ${band.id}: ${selected.length}/${band.target} (invalid ${rejectedInvalid}, dup ${rejectedDup})`,
    );
  }

  shuffleInPlace(finalList, rng);

  // Cap hard ceiling if somehow over.
  const capped = finalList.slice(0, CFG.maxPuzzles);

  const dist = {};
  for (const p of capped) {
    for (const t of p.themes) dist[t] = (dist[t] || 0) + 1;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const puzzlesPath = path.join(outDir, 'puzzles.json');
  fs.writeFileSync(puzzlesPath, JSON.stringify(capped));
  const sizeBytes = fs.statSync(puzzlesPath).size;

  const ratings = capped.map((p) => p.rating);
  const ratingMin = ratings.length ? Math.min(...ratings) : CFG.minRating;
  const ratingMax = ratings.length ? Math.max(...ratings) : CFG.maxRating;

  const manifest = {
    version: 2,
    sourceUrl: CFG.sourceUrl,
    license: CFG.sourceLicense,
    seed: CFG.selectionSeed,
    selectionSeed: CFG.selectionSeed,
    ratingMin,
    ratingMax,
    minRating: ratingMin,
    maxRating: ratingMax,
    filters: {
      popularityMin: CFG.popularityMin,
      nbPlaysMin: CFG.nbPlaysMin,
      ratingDeviationMax: CFG.ratingDeviationMax,
    },
    bands: CFG.ratingBands.map((b) => ({
      id: b.id,
      label: b.label,
      min: b.min,
      max: b.max,
      target: b.target,
      count: perBandCounts[b.id] || 0,
    })),
    count: capped.length,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const report = {
    ...manifest,
    scanned,
    eligible,
    scanDuplicatesSkipped: scanDupes,
    selectionDuplicatesRejected: totalRejectedDup,
    invalidLinesRejected: totalRejectedInvalid,
    duplicatesRemoved: scanDupes + totalRejectedDup,
    sizeBytes,
    sizeKB: Math.round(sizeBytes / 1024),
    perBandCounts,
    perBandThemes,
    themeDistribution: Object.fromEntries(
      Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 50),
    ),
  };
  fs.writeFileSync(path.join(outDir, 'build-report.json'), JSON.stringify(report, null, 2));

  console.log(`Wrote ${capped.length} puzzles → ${puzzlesPath} (${report.sizeKB} KB)`);
  console.log('Per-band counts:', perBandCounts);
  console.log('Top themes:', report.themeDistribution);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
