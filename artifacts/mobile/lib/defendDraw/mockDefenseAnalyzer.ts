/**
 * Test-only mock defence analyser (no WASM / no platform transport).
 */
import { createMockChessEngineService } from '../engines/analysis/ChessEngineService.ts';
import type { DefenseAnalysis, DefenseAnalyzer } from './defenseTypes.ts';

export function createMockDefenseAnalyzer(
  handler: (fen: string) => DefenseAnalysis | Promise<DefenseAnalysis>,
): DefenseAnalyzer {
  const mock = createMockChessEngineService(async (fen) => {
    const d = await Promise.resolve(handler(fen));
    return {
      bestMove: d.bestMove,
      score:
        d.mateIn != null
          ? { type: 'mate' as const, value: d.mateIn }
          : { type: 'cp' as const, value: d.scoreCp },
      scoreCp: d.scoreCp,
      mateIn: d.mateIn,
      wdl: d.wdl,
      depth: d.depth,
    };
  });
  return {
    analyze: (fen, movetimeMs) => mock.analyze(fen, movetimeMs),
    destroy: () => mock.destroy(),
  };
}
