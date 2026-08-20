/**
 * Defense-mode analyser — thin adapter over ChessEngineService.
 *
 * Web binds WASM via Metro platform resolve:
 *   createChessEngineService → createChessEngineService.web.ts
 *   → transport.web.ts (Worker)
 *
 * Import of the factory MUST omit the `.ts` extension so Metro can pick `.web`.
 */
import {
  ChessEngineService,
} from '../engines/analysis/ChessEngineService.ts';
import { createChessEngineService } from '../engines/analysis/createChessEngineService';
import type { ChessEngineServiceOptions, EngineAnalysis } from '../engines/analysis/types.ts';
import type {
  DefenseAnalysis,
  DefenseAnalyzer,
  DefenseBestMove,
} from './defenseTypes.ts';

export type { DefenseAnalysis, DefenseAnalyzer, DefenseBestMove };

export type StockfishAnalysisServiceOptions = ChessEngineServiceOptions;

function toDefense(a: EngineAnalysis): DefenseAnalysis {
  return {
    scoreCp: a.scoreCp,
    mateIn: a.mateIn,
    depth: a.depth,
    wdl: a.wdl,
    bestMove: a.bestMove,
    lines: a.lines,
  };
}

/**
 * Full-strength Stockfish analyser for Défends la nulle.
 * Delegates to ChessEngineService (shared UCI lifecycle).
 */
export class StockfishAnalysisService implements DefenseAnalyzer {
  private readonly engine: ChessEngineService;

  constructor(options: StockfishAnalysisServiceOptions = {}) {
    this.engine = createChessEngineService(options);
  }

  getStatus() {
    return this.engine.getStatus();
  }

  getLastError() {
    return this.engine.getLastError();
  }

  onStatusChange(listener: (status: ReturnType<ChessEngineService['getStatus']>) => void) {
    return this.engine.onStatusChange(listener);
  }

  init(): Promise<void> {
    return this.engine.init();
  }

  isAvailable(): Promise<boolean> {
    return this.engine.isAvailable();
  }

  destroy(): void {
    this.engine.destroy();
  }

  async analyze(fen: string, movetimeMs?: number): Promise<DefenseAnalysis> {
    return toDefense(await this.engine.analyze(fen, movetimeMs));
  }

  async analyzePosition(options: {
    fen: string;
    movetimeMs?: number;
    multiPv?: number;
  }): Promise<DefenseAnalysis> {
    return toDefense(
      await this.engine.analyzePosition({
        fen: options.fen,
        movetimeMs: options.movetimeMs,
        multiPv: options.multiPv,
      }),
    );
  }

  getEngine(): ChessEngineService {
    return this.engine;
  }
}
