/**
 * Authoring script: certify CERTIFIED_DEFEND_DRAW_POSITIONS via Syzygy (Lichess)
 * and optional Stockfish injection.
 *
 * Usage:
 *   node --experimental-strip-types scripts/certify-defend-draw-positions.mjs
 *
 * Does NOT run at app startup. Exit code 1 if any dataset row fails certification.
 */
import { CERTIFIED_DEFEND_DRAW_POSITIONS } from '../lib/defendDraw/positions.ts';
import { certifyDefendDrawPosition } from '../lib/defendDraw/certifyPosition.ts';
import { isAcceptableVerifiedDrawFlag } from '../lib/defendDraw/certification.ts';

const results = [];
let rejected = 0;
let validated = 0;

console.log(`Certifying ${CERTIFIED_DEFEND_DRAW_POSITIONS.length} dataset rows…\n`);

for (const pos of CERTIFIED_DEFEND_DRAW_POSITIONS) {
  const cert = await certifyDefendDrawPosition(
    {
      id: pos.id,
      fen: pos.fen,
      defenderColor: pos.defenderColor,
      legalMoves: pos.legalMoves,
      drawingMoves: pos.drawingMoves,
    },
    { allowStockfishFallback: false, tablebaseTimeoutMs: 12_000 },
  );

  if (!cert.ok) {
    rejected += 1;
    results.push({ id: pos.id, status: 'rejected', reason: cert.reason });
    console.log(`✗ ${pos.id}  REJECTED — ${cert.reason}`);
    continue;
  }

  if (!isAcceptableVerifiedDrawFlag(pos.verifiedDraw, pos.verification)) {
    rejected += 1;
    results.push({
      id: pos.id,
      status: 'rejected',
      reason: 'dataset verification metadata insufficient',
    });
    console.log(`✗ ${pos.id}  REJECTED — dataset metadata insufficient`);
    continue;
  }

  if (pos.verification.method !== cert.verification.method) {
    rejected += 1;
    results.push({
      id: pos.id,
      status: 'rejected',
      reason: `method mismatch dataset=${pos.verification.method} live=${cert.verification.method}`,
    });
    console.log(
      `✗ ${pos.id}  REJECTED — method mismatch (${pos.verification.method} vs ${cert.verification.method})`,
    );
    continue;
  }

  validated += 1;
  results.push({
    id: pos.id,
    status: 'validated',
    method: cert.verification.method,
    difficulty: pos.difficulty,
  });
  console.log(
    `✓ ${pos.id}  ${pos.difficulty.padEnd(11)}  method=${cert.verification.method}  theme=${pos.theme}`,
  );

  await new Promise((r) => setTimeout(r, 120));
}

console.log('\n── Summary ──');
console.log(`validated: ${validated}`);
console.log(`rejected:  ${rejected}`);
const byMethod = {};
for (const r of results) {
  if (r.status === 'validated') {
    byMethod[r.method] = (byMethod[r.method] || 0) + 1;
  }
}
console.log('by method:', byMethod);

if (rejected > 0) {
  process.exitCode = 1;
}
