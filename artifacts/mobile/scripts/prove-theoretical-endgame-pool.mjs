/**
 * Independent check of the theoretical catalog.
 * ≤7 pieces: Lichess Syzygy (exact). >7: Stockfish 18 Lite depth 16 (not exact).
 * Play never calls these services. A failing position is reported and must
 * stay out of the playable catalog.
 *
 * Usage:
 *   node scripts/prove-theoretical-endgame-pool.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '../package.json'));
const { Chess } = require('chess.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL = join(ROOT, 'lib/theoreticalEndgame/data/canonical.positions.json');
const OUT = join(ROOT, 'lib/theoreticalEndgame/data/validation-report.md');

function pieces(fen) {
  return (fen.split(' ')[0] ?? '').replace(/[^KQRBNPkqrbnp]/g, '').length;
}

async function syzygy(fen) {
  const url = `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`syzygy HTTP ${res.status}`);
  return res.json();
}

function categoryMatches(objective, category) {
  if (objective === 'WIN') return category === 'win';
  if (objective === 'DRAW') return category === 'draw';
  return false;
}

let sharedEngine = null;
async function engineOnce() {
  if (sharedEngine) return sharedEngine;
  const init = require('stockfish');
  sharedEngine = await init('lite-single');
  await new Promise((resolve) => {
    sharedEngine.listener = (line) => {
      if (String(line).startsWith('readyok')) resolve();
    };
    sharedEngine.sendCommand('uci');
    sharedEngine.sendCommand('isready');
  });
  return sharedEngine;
}

function stockfishBest(fen) {
  return engineOnce().then(
    (engine) =>
      new Promise((resolve, reject) => {
        let cp = null;
        let depth = 0;
        const timer = setTimeout(() => reject(new Error('stockfish timeout')), 20000);
        engine.listener = (line) => {
          const text = String(line);
          const d = text.match(/info depth (\d+) .*score cp (-?\d+)/);
          if (d) {
            depth = Number(d[1]);
            cp = Number(d[2]);
          }
          const bm = text.match(/^bestmove (\S+)/);
          if (bm) {
            clearTimeout(timer);
            resolve({ best: bm[1], cp, depth });
          }
        };
        engine.sendCommand(`position fen ${fen}`);
        engine.sendCommand('go depth 16');
      }),
  );
}

const doc = JSON.parse(readFileSync(CANONICAL, 'utf8'));
const positions = (doc.positions ?? []).filter((p) => p.active !== false);
const rows = [];
let failed = 0;

const tablebase = positions.filter((p) => pieces(p.initialFen) <= 7);
const enginePositions = positions.filter((p) => pieces(p.initialFen) > 7);

async function checkOne(pos) {
  const n = pieces(pos.initialFen);
  const side = pos.initialFen.split(' ')[1] === 'b' ? 'black' : 'white';
  let status = 'verified';
  let method = '';
  let detail = '';
  try {
    if (n <= 7) {
      const tb = await syzygy(pos.initialFen);
      method = 'syzygy-7 exact';
      const reportedDtm = tb.dtm == null ? null : tb.dtm;
      const mateDtm = tb.category === 'win' && typeof reportedDtm === 'number' && reportedDtm > 0 ? reportedDtm : null;
      const dtmOk =
        pos.objective === 'WIN'
          ? reportedDtm === pos.proof?.dtm && pos.proof?.dtm > 0
          : pos.proof?.dtm == null && pos.proof?.dtmReported === reportedDtm;
      const dtzOk = tb.dtz === pos.proof?.dtz;
      const categoryOk = pos.proof?.category === tb.category && categoryMatches(pos.objective, tb.category);
      const ok = categoryOk && dtmOk && dtzOk;
      if (!ok) {
        status = 'rejected';
        failed += 1;
      }
      detail = `category=${tb.category} dtz=${tb.dtz} dtm=${mateDtm == null ? 'null' : mateDtm} dtmReported=${reportedDtm == null ? 'null' : reportedDtm} source=lichess-syzygy`;
    } else {
      const found = await stockfishBest(pos.initialFen);
      method = 'stockfish-18-lite depth 16 (not exact)';
      const ok = found.best === pos.proof?.bestMove && found.cp != null && found.cp >= 400;
      if (!ok) {
        status = 'rejected';
        failed += 1;
      }
      detail = `best=${found.best} cp=${found.cp} depth=${found.depth}`;
    }
  } catch (err) {
    status = 'unverified';
    failed += 1;
    method = n <= 7 ? 'syzygy-7' : 'stockfish-18-lite';
    detail = err.message;
  }
  const game = new Chess(pos.initialFen);
  if (game.isGameOver() || side !== pos.playerColor) {
    status = 'rejected';
    failed += 1;
    detail = `${detail}; terminal or side mismatch`;
  }
  rows.push({ id: pos.id, fen: pos.initialFen, side, objective: pos.objective, status, method, detail, note: pos.variantNote?.fr ?? '' });
  console.log(`${status} ${pos.id} ${detail}`);
}

for (const pos of tablebase) await checkOne(pos);
for (const pos of enginePositions) await checkOne(pos);

const lines = [
  '# Validation des finales théoriques',
  '',
  `Généré le ${new Date().toISOString()}. ${positions.length} variantes actives, ${failed} en échec.`,
  '',
  'Méthode : table Syzygy Lichess pour 7 pièces ou moins (exacte, point de vue du trait). Stockfish 18 Lite profondeur 16 pour les percées à 8 pièces : recherche, pas une table. Le jeu n’appelle ni l’un ni l’autre.',
  '',
  '| id | camp | objectif | statut | méthode | détail |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows.map(
    (r) => `| ${r.id} | ${r.side} | ${r.objective} | ${r.status} | ${r.method} | ${r.detail.replace(/\|/g, '/')} |`,
  ),
  '',
  '## Justification pédagogique',
  '',
  ...rows.map((r) => `- **${r.id}** — ${r.note}`),
  '',
];

writeFileSync(OUT, lines.join('\n'));
console.log(`report ${OUT}`);
if (failed > 0) process.exit(1);
