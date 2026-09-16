/**
 * Stockfish adapter over ChessEngineService (web: WASM Worker).
 * Native later: inject ChessEngineService with a native UCI transport.
 */
import {
  ChessEngineService,
  createChessEngineService,
  type EngineAnalysis,
} from '@/lib/engines/analysis';
import type {
  AnalyzePositionRequest,
  ChessEngine,
  ChessEngineLifecycleStatus,
} from './ChessEngine.ts';

export type StockfishChessEngineOptions = {
  service?: ChessEngineService;
};

export class StockfishChessEngine implements ChessEngine {
  private readonly service: ChessEngineService;
  private disposed = false;

  constructor(options: StockfishChessEngineOptions = {}) {
    this.service = options.service ?? createChessEngineService();
  }

  getStatus(): ChessEngineLifecycleStatus {
    if (this.disposed) return 'unavailable';
    const s = this.service.getStatus();
    if (s === 'unavailable') return 'unavailable';
    if (s === 'error') return 'error';
    if (s === 'thinking') return 'analyzing';
    if (s === 'ready') return 'ready';
    return 'initializing';
  }

  async init(): Promise<void> {
    if (this.disposed) throw new Error('[StockfishChessEngine] Disposed.');
    await this.service.init();
  }

  async analyzePosition(req: AnalyzePositionRequest): Promise<EngineAnalysis> {
    if (this.disposed) throw new Error('[StockfishChessEngine] Disposed.');
    return this.service.analyzePosition({
      fen: req.fen,
      depth: req.profile.depth,
      movetimeMs: req.profile.movetimeMs,
      multiPv: req.multiPv ?? req.profile.multiPv,
    });
  }

  async stop(): Promise<void> {
    await this.service.stop();
  }

  dispose(): void {
    this.disposed = true;
    this.service.destroy();
  }
}

export function createStockfishChessEngine(
  options?: StockfishChessEngineOptions,
): ChessEngine {
  return new StockfishChessEngine(options);
}
