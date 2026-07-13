/**
 * Build a FEN-keyed opening index from the CC0 lichess-org/chess-openings TSVs.
 *
 * Usage (from artifacts/mobile):
 *   node scripts/build-openings-index.mjs
 *
 * Expects a.tsv … e.tsv in lib/openings/data/ (download from
 * https://github.com/lichess-org/chess-openings).
 *
 * Writes lib/openings/data/openings.json keyed by position (FEN fields 1–4)
 * so transpositions resolve to the same opening.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Chess } = require('chess.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'lib', 'openings', 'data');
const outFile = path.join(dataDir, 'openings.json');

function positionKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

function parsePgnMoves(pgn) {
  // "1. e4 e5 2. Nf3 Nc6" → ["e4","e5","Nf3","Nc6"]
  return pgn
    .replace(/\d+\.(\.\.)?/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t && !/^\$/.test(t) && !/^[012*]/.test(t));
}

function ingestTsv(filePath, index) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  let added = 0;
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || i === 0 && line.startsWith('eco')) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [eco, name, pgn] = parts;
    if (!eco || !name || !pgn) continue;

    const moves = parsePgnMoves(pgn);
    const chess = new Chess();
    let ok = true;
    for (const san of moves) {
      try {
        if (!chess.move(san)) {
          ok = false;
          break;
        }
      } catch {
        ok = false;
        break;
      }
    }
    if (!ok || moves.length === 0) {
      skipped += 1;
      continue;
    }

    const ply = moves.length;
    const key = positionKey(chess.fen());
    const prev = index.get(key);
    // Prefer the deepest (most specific) definition for a shared end-position.
    if (!prev || ply > prev.ply || (ply === prev.ply && name.length > prev.name.length)) {
      index.set(key, { eco, name, ply });
    }
    added += 1;
  }
  return { added, skipped };
}

const index = new Map();
let totalAdded = 0;
let totalSkipped = 0;

for (const letter of ['a', 'b', 'c', 'd', 'e']) {
  const file = path.join(dataDir, `${letter}.tsv`);
  if (!fs.existsSync(file)) {
    console.error(`Missing ${file}. Download from lichess-org/chess-openings.`);
    process.exit(1);
  }
  const { added, skipped } = ingestTsv(file, index);
  totalAdded += added;
  totalSkipped += skipped;
  console.log(`${letter}.tsv: ${added} openings (${skipped} skipped)`);
}

const obj = Object.fromEntries(index);
fs.writeFileSync(outFile, JSON.stringify(obj));
const sizeKb = Math.round(fs.statSync(outFile).size / 1024);
console.log(
  `Wrote ${outFile} — ${index.size} positions from ${totalAdded} lines (${totalSkipped} skipped), ${sizeKb} KB`,
);
