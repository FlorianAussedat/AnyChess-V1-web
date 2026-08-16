/**
 * Stockfish analysis for Défends la nulle — full strength, optional WDL.
 * Owns its own UCI transport (independent of Classic's Elo-limited engine).
 */
import { Chess } from 'chess.js';
import { createUciTransport } from '../engines/stockfish/transport.ts';
import type { UciTransport } from '../engines/stockfish/types.ts';
import {
  DEFAULT_STOCKFISH_CONFIG,
  fullStrengthAnalysisOptionCommands,
  parseBestMove,
  parseInfoScoreSnapshot,
  type InfoScoreSnapshot,
} from '../engines/stockfish/uci.ts';

export type DefenseBestMove = {
  from: string;
  to: string;
  promotion?: string;
};

/** Side-to-move perspective. */
export type DefenseAnalysis = {
  scoreCp: number;
  mateIn: number | null;
  depth: number;
  wdl: { win: number; draw: number; loss: number } | null;
  bestMove: DefenseBestMove | null;
};

export interface DefenseAnalyzer {
  analyze(fen: string): Promise<DefenseAnalysis>;
  destroy?(): void;
}

export type StockfishAnalysisServiceOptions = {
  enginePath?: string;
  moveTimeMs?: number;
  bootTimeoutMs?: number;
};

type PendingAnalysis = {
  resolve: (result: DefenseAnalysis) => void;
  reject: (err: Error) => void;
  fen: string;
  latest: InfoScoreSnapshot | null;
};

/**
 * Full-strength Stockfish analyser used only by Défends la nulle.
 */
export class StockfishAnalysisService implements DefenseAnalyzer {
  private transport: UciTransport | null = null;
  private readyPromise: Promise<void> | null = null;
  private isReady = false;
  private destroyed = false;
  private bootTimeout: ReturnType<typeof setTimeout> | null = null;
  private pending: PendingAnalysis | null = null;
  private readonly enginePath: string;
  private readonly moveTimeMs: number;
  private readonly bootTimeoutMs: number;

  constructor(options: StockfishAnalysisServiceOptions = {}) {
    this.enginePath = options.enginePath ?? DEFAULT_STOCKFISH_CONFIG.enginePath;
    this.moveTimeMs = options.moveTimeMs ?? 900;
    this.bootTimeoutMs = options.bootTimeoutMs ?? 30_000;
  }

  init(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('[StockfishAnalysisService] Destroyed.'));
    }
    if (!this.readyPromise) {
      this.readyPromise = this.boot().catch((err) => {
        this.readyPromise = null;
        throw err;
      });
    }
    return this.readyPromise;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      p.reject(new Error('[StockfishAnalysisService] Destroyed during analysis.'));
    }
    this.disposeTransport();
    this.readyPromise = null;
  }

  async analyze(fen: string): Promise<DefenseAnalysis> {
    await this.init();
    if (!this.transport || this.destroyed) {
      throw new Error('[StockfishAnalysisService] Not ready.');
    }
    if (this.pending) {
      this.transport.send('stop');
      const stale = this.pending;
      this.pending = null;
      stale.resolve(this.snapshotFromLatest(stale.fen, stale.latest, null));
    }

    return new Promise<DefenseAnalysis>((resolve, reject) => {
      this.pending = { resolve, reject, fen, latest: null };
      this.transport!.send(`position fen ${fen}`);
      this.transport!.send(`go movetime ${this.moveTimeMs}`);
    });
  }

  private snapshotFromLatest(
    fen: string,
    latest: InfoScoreSnapshot | null,
    bestMove: DefenseBestMove | null,
  ): DefenseAnalysis {
    return {
      scoreCp: latest?.scoreCp ?? 0,
      mateIn: latest?.mateIn ?? null,
      depth: latest?.depth ?? 0,
      wdl: latest?.wdl ?? null,
      bestMove,
    };
  }

  private clearBootTimeout(): void {
    if (this.bootTimeout != null) {
      clearTimeout(this.bootTimeout);
      this.bootTimeout = null;
    }
  }

  private disposeTransport(): void {
    this.clearBootTimeout();
    const transport = this.transport;
    this.transport = null;
    this.isReady = false;
    if (!transport) return;
    try {
      transport.send('quit');
    } catch {
      /* ignore */
    }
    try {
      transport.terminate();
    } catch {
      /* ignore */
    }
  }

  private boot(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let transport: UciTransport;
      try {
        transport = createUciTransport(this.enginePath);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      this.transport = transport;

      const failBoot = (error: Error) => {
        if (this.transport === transport) this.disposeTransport();
        reject(error);
      };

      this.bootTimeout = setTimeout(() => {
        this.bootTimeout = null;
        if (this.destroyed || this.isReady) return;
        failBoot(new Error('[StockfishAnalysisService] Boot timeout.'));
      }, this.bootTimeoutMs);

      const onLine = (line: string) => {
        if (this.destroyed || this.transport !== transport) return;

        if (!this.isReady) {
          if (line.startsWith('uciok')) {
            for (const cmd of fullStrengthAnalysisOptionCommands(1)) {
              transport.send(cmd);
            }
            transport.send('isready');
            return;
          }
          if (line.startsWith('readyok')) {
            this.isReady = true;
            this.clearBootTimeout();
            resolve();
            return;
          }
        }

        if (this.pending && line.startsWith('info ')) {
          const snap = parseInfoScoreSnapshot(line);
          if (snap) this.pending.latest = snap;
          return;
        }

        if (this.pending && line.startsWith('bestmove')) {
          const pending = this.pending;
          this.pending = null;
          const uci = parseBestMove(line);
          let bestMove: DefenseBestMove | null = null;
          if (uci) {
            const legal = new Chess(pending.fen).moves({ verbose: true });
            const match = legal.find(
              (m) =>
                m.from === uci.from &&
                m.to === uci.to &&
                (!uci.promotion || m.promotion === uci.promotion),
            );
            if (match) {
              bestMove = {
                from: match.from,
                to: match.to,
                promotion: match.promotion,
              };
            } else {
              bestMove = {
                from: uci.from,
                to: uci.to,
                promotion: uci.promotion,
              };
            }
          }
          // Prefer PV move from last info if bestmove missing.
          if (!bestMove && pending.latest?.pvMove) {
            const raw = pending.latest.pvMove;
            bestMove = {
              from: raw.slice(0, 2),
              to: raw.slice(2, 4),
              promotion: raw.length > 4 ? raw[4]!.toLowerCase() : undefined,
            };
          }
          pending.resolve(this.snapshotFromLatest(pending.fen, pending.latest, bestMove));
        }
      };

      transport
        .start(onLine)
        .then(() => {
          if (this.destroyed || this.transport !== transport) {
            try {
              transport.terminate();
            } catch {
              /* ignore */
            }
            reject(new Error('[StockfishAnalysisService] Destroyed before start.'));
            return;
          }
          transport.send('uci');
        })
        .catch((err) => {
          failBoot(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }
}

/** Deterministic mock analyser for unit tests (no WASM). */
export function createMockDefenseAnalyzer(
  handler: (fen: string) => DefenseAnalysis | Promise<DefenseAnalysis>,
): DefenseAnalyzer {
  return {
    analyze: (fen) => Promise.resolve(handler(fen)),
  };
}
