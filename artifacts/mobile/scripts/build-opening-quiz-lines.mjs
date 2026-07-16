/**
 * Build opening quiz lines from lichess-org/chess-openings TSVs.
 *
 * Usage (from artifacts/mobile):
 *   node scripts/build-opening-quiz-lines.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Chess } = require('chess.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'lib', 'openings', 'data');
const openingsJson = path.join(dataDir, 'openings.json');
const outFile = path.join(__dirname, '..', 'lib', 'openingQuiz', 'data', 'quizLines.json');

const MIN_PLY = 4;
const MAX_PLY = 16;

function positionKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

function parsePgnMoves(pgn) {
  return pgn
    .replace(/\d+\.(\.\.)?/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t && !/^\$/.test(t) && !/^[012*]/.test(t));
}

function familyName(fullName) {
  const idx = fullName.indexOf(':');
  return idx === -1 ? fullName.trim() : fullName.slice(0, idx).trim();
}

function ingestTsv(filePath, index, openingIndex) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || (i === 0 && line.startsWith('eco'))) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [eco, name, pgn] = parts;
    if (!eco || !name || !pgn) continue;

    const moves = parsePgnMoves(pgn);
    if (moves.length < MIN_PLY || moves.length > MAX_PLY) continue;

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
    if (!ok) continue;

    const hit = openingIndex[positionKey(chess.fen())];
    if (!hit || hit.name !== name || hit.ply !== moves.length) continue;

    const family = familyName(name);
    const key = `${family}::${name}`;
    const prev = index.get(key);
    if (!prev || moves.length < prev.sans.length) {
      index.set(key, {
        eco,
        name,
        family,
        sans: moves,
        ply: moves.length,
      });
    }
  }
}

function main() {
  const openingIndex = JSON.parse(fs.readFileSync(openingsJson, 'utf8'));
  const index = new Map();

  for (const letter of ['a', 'b', 'c', 'd', 'e']) {
    const tsv = path.join(dataDir, `${letter}.tsv`);
    if (fs.existsSync(tsv)) ingestTsv(tsv, index, openingIndex);
  }

  const lines = [...index.values()].sort((a, b) => {
    if (a.family !== b.family) return a.family.localeCompare(b.family);
    return a.name.localeCompare(b.name);
  });

  const families = [...new Set(lines.map((l) => l.family))].sort();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(
    outFile,
    JSON.stringify({ generatedAt: new Date().toISOString(), families, lines }, null, 2),
  );
  console.log(`Wrote ${lines.length} quiz lines across ${families.length} families → ${outFile}`);
}

main();
