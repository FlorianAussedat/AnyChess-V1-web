/**
 * White-centric scores through the bundled Stockfish process.
 * This is a Node engine run, not a native Android validation.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { ChessEngineService } from '../../engines/analysis/ChessEngineService.ts';
import { createWasmStockfishTransport } from '../../theoreticalEndgame/analysis/wasmStockfishTransport.ts';
import { mapEngineAnalysisToPosition } from '../mapEngineAnalysis.ts';
import { sideToMoveFromFen } from '../scoreWhite.ts';
import { legalUci } from '../reviewFocus.ts';
import type { PositionAnalysis } from '../types.ts';

const enginePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../public/engine/stockfish-18-lite-single.js',
);

/** Legal KQ vs K. The queen does not already check the king who is not to move. */
const WHITE_QUEEN = '8/8/8/4k3/8/8/8/4K2Q w - - 0 1';
const BLACK_QUEEN = '8/8/8/4K3/8/8/8/4k2q w - - 0 1';
/** Side not to move is in check: Stockfish reports an empty search, not +0.00. */
const ILLEGAL_CHECK = '4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1';

function advantageSign(position: PositionAnalysis): number {
  if (position.terminalOutcome === 'white') return 1;
  if (position.terminalOutcome === 'black') return -1;
  if (position.terminalOutcome === 'draw') return 0;
  if (position.mate != null && position.mate !== 0) return Math.sign(position.mate);
  if (position.evaluation != null && position.evaluation !== 0) {
    return Math.sign(position.evaluation);
  }
  return 0;
}

async function analyze(engine: ChessEngineService, fen: string) {
  const raw = await engine.analyzePosition({
    fen,
    movetimeMs: 250,
    depth: 10,
    multiPv: 2,
  });
  const mapped = mapEngineAnalysisToPosition(fen, raw, 'fast');
  assert.ok(mapped);
  assert.equal(mapped!.evalPerspective, 'white');
  assert.equal(mapped!.fen, fen);
  if (raw.mateIn != null && mapped!.mate != null && !mapped!.terminalOutcome) {
    const expected = sideToMoveFromFen(fen) === 'w' ? raw.mateIn : -raw.mateIn;
    assert.equal(mapped!.mate, expected);
  }
  if (mapped!.bestMove && !mapped!.terminalOutcome) {
    assert.ok(legalUci(fen, mapped!.bestMove));
  }
  return { raw, mapped: mapped! };
}

describe('Stockfish white perspective', { timeout: 90000 }, () => {
  it('keeps the White-centric sign when the side to move changes', async () => {
    const engine = new ChessEngineService({
      createTransport: createWasmStockfishTransport,
      enginePath,
      moveTimeMs: 250,
      analysisTimeoutMs: 8000,
      bootTimeoutMs: 45000,
    });
    await engine.init();
    try {
      const whiteBefore = await analyze(engine, WHITE_QUEEN);
      assert.equal(advantageSign(whiteBefore.mapped), 1);
      assert.ok(whiteBefore.mapped.bestMove);
      const chess = new Chess(WHITE_QUEEN);
      const played = chess.move({
        from: whiteBefore.mapped.bestMove!.slice(0, 2),
        to: whiteBefore.mapped.bestMove!.slice(2, 4),
        promotion: whiteBefore.mapped.bestMove!.length > 4
          ? (whiteBefore.mapped.bestMove![4] as 'q')
          : undefined,
      });
      assert.ok(played);
      const whiteAfter = await analyze(engine, chess.fen());
      assert.equal(sideToMoveFromFen(chess.fen()), 'b');
      assert.equal(advantageSign(whiteAfter.mapped), 1);

      const blackBefore = await analyze(engine, BLACK_QUEEN);
      assert.equal(advantageSign(blackBefore.mapped), -1);
      const losing = new Chess(BLACK_QUEEN);
      assert.ok(blackBefore.mapped.bestMove);
      losing.move({
        from: blackBefore.mapped.bestMove!.slice(0, 2),
        to: blackBefore.mapped.bestMove!.slice(2, 4),
      });
      const blackAfter = await analyze(engine, losing.fen());
      assert.equal(advantageSign(blackAfter.mapped), -1);

      const illegal = await engine.analyzePosition({
        fen: ILLEGAL_CHECK,
        movetimeMs: 200,
        depth: 6,
      });
      assert.equal(
        mapEngineAnalysisToPosition(ILLEGAL_CHECK, illegal, 'fast'),
        null,
      );
    } finally {
      engine.destroy();
    }
  });
});
