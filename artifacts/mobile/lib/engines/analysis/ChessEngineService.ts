/**
 * ChessEngineService — shared full-strength Stockfish analysis facade.
 *
 * Owns one UCI transport when provided. Screens never see UCI / WASM.
 * Never falls back to a random-move opponent.
 *
 * Search lifecycle:
 * - At most one active search on the transport.
 * - stop() waits (bounded) for bestmove before a new go.
 * - Late info/bestmove for a previous epoch are ignored.
 * - Cancelled searches never surface as fake 0.00 evals.
 * - Illegal bestmoves for the analyzed FEN are discarded.
 */
import { Chess } from 'chess.js';
import type { UciTransport } from '../stockfish/types.ts';
import {
  DEFAULT_STOCKFISH_CONFIG,
  fullStrengthAnalysisOptionCommands,
  parseBestMove,
  parseInfoScoreSnapshot,
  type InfoScoreSnapshot,
} from '../stockfish/uci.ts';
import { AnalysisCancelledError } from './AnalysisCancelledError.ts';
import type {
  AnalyzePositionOptions,
  ChessEngineServiceOptions,
  EngineAnalysis,
  EngineBestMove,
  EngineScore,
  EngineStatus,
} from './types.ts';
import { STOCKFISH_PLATFORM_NOTES } from './types.ts';

type PendingAnalysis = {
  /** Monotonic search epoch — only matching bestmove may settle this pending. */
  epoch: number;
  resolve: (result: EngineAnalysis) => void;
  reject: (err: Error) => void;
  fen: string;
  latest: InfoScoreSnapshot | null;
  linesByPv: Map<number, InfoScoreSnapshot>;
  multiPv: number;
  timeout: ReturnType<typeof setTimeout> | null;
  /** When true, settle as cancelled (never as a complete analysis). */
  cancelled: boolean;
};

const STOP_WAIT_MS = 750;

function toBestMove(
  from: string,
  to: string,
  promotion?: string,
): EngineBestMove {
  const uci = `${from}${to}${promotion ?? ''}`;
  return { from, to, promotion, uci };
}

function cancelledAnalysis(): EngineAnalysis {
  return {
    bestMove: null,
    score: null,
    scoreCp: 0,
    mateIn: null,
    wdl: null,
    depth: 0,
    lines: [],
    cancelled: true,
  };
}

function snapshotToAnalysis(
  latest: InfoScoreSnapshot | null,
  bestMove: EngineBestMove | null,
  lines: EngineAnalysis['lines'] = [],
): EngineAnalysis {
  let score: EngineScore | null = null;
  let scoreCp = 0;
  let mateIn: number | null = null;
  if (latest) {
    scoreCp = latest.scoreCp;
    mateIn = latest.mateIn;
    if (latest.mateIn != null) {
      score = { type: 'mate', value: latest.mateIn };
    } else {
      score = { type: 'cp', value: latest.scoreCp };
    }
  }
  return {
    bestMove,
    score,
    scoreCp,
    mateIn,
    wdl: latest?.wdl ?? null,
    depth: latest?.depth ?? 0,
    lines,
    cancelled: false,
  };
}

/** Only return a move that is legal in `fen`. Never invent illegal suggestions. */
function resolveLegalBestMove(
  fen: string,
  uci: { from: string; to: string; promotion?: string } | null,
  pvMove: string | null,
): EngineBestMove | null {
  let legal;
  try {
    legal = new Chess(fen).moves({ verbose: true });
  } catch {
    return null;
  }
  const tryMatch = (from: string, to: string, promotion?: string) => {
    const match = legal.find(
      (m) =>
        m.from === from &&
        m.to === to &&
        (!promotion || m.promotion === promotion),
    );
    if (!match) return null;
    return toBestMove(match.from, match.to, match.promotion);
  };

  if (uci) {
    const hit = tryMatch(uci.from, uci.to, uci.promotion);
    if (hit) return hit;
  }
  if (pvMove && pvMove.length >= 4) {
    return tryMatch(
      pvMove.slice(0, 2),
      pvMove.slice(2, 4),
      pvMove.length > 4 ? pvMove[4]!.toLowerCase() : undefined,
    );
  }
  return null;
}

function filterLegalPv(fen: string, pv: string[]): string[] {
  if (pv.length === 0) return [];
  try {
    const chess = new Chess(fen);
    const out: string[] = [];
    for (const token of pv) {
      if (token.length < 4) break;
      const from = token.slice(0, 2);
      const to = token.slice(2, 4);
      const promotion = token.length > 4 ? token[4]!.toLowerCase() : undefined;
      const match = chess
        .moves({ verbose: true })
        .find(
          (m) =>
            m.from === from &&
            m.to === to &&
            (!promotion || m.promotion === promotion),
        );
      if (!match) break;
      chess.move(match);
      out.push(
        `${match.from}${match.to}${match.promotion ?? ''}`,
      );
    }
    return out;
  } catch {
    return [];
  }
}

export class ChessEngineService {
  private transport: UciTransport | null = null;
  private readyPromise: Promise<void> | null = null;
  private destroyed = false;
  private bootTimeout: ReturnType<typeof setTimeout> | null = null;
  private pending: PendingAnalysis | null = null;
  /** Epoch of the last go; incremented for each search and stop. */
  private searchEpoch = 0;
  /** Resolves when a stop's bestmove (or timeout) arrives. */
  private stopWaiters = new Set<() => void>();
  private status: EngineStatus = 'uninitialized';
  private lastError: string | null = null;
  private readonly enginePath: string;
  private readonly defaultMoveTimeMs: number;
  private readonly bootTimeoutMs: number;
  private readonly analysisTimeoutMs: number;
  private readonly createTransport: ((enginePath: string) => UciTransport) | null;
  private readonly listeners = new Set<(status: EngineStatus) => void>();
  private activeMultiPv = 1;

  constructor(options: ChessEngineServiceOptions = {}) {
    this.enginePath = options.enginePath ?? DEFAULT_STOCKFISH_CONFIG.enginePath;
    this.defaultMoveTimeMs = options.moveTimeMs ?? 1000;
    this.bootTimeoutMs = options.bootTimeoutMs ?? 30_000;
    this.analysisTimeoutMs = options.analysisTimeoutMs ?? 12_000;
    this.createTransport = options.createTransport ?? null;

    if (!this.createTransport) {
      this.status = 'unavailable';
      this.lastError = STOCKFISH_PLATFORM_NOTES.expoGo.reason;
    }
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  onStatusChange(listener: (status: EngineStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(next: EngineStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const l of this.listeners) l(next);
  }

  isAvailable(): Promise<boolean> {
    if (this.status === 'unavailable') return Promise.resolve(false);
    return this.init()
      .then(() => true)
      .catch(() => false);
  }

  init(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('[ChessEngineService] Destroyed.'));
    }
    if (this.status === 'unavailable' || !this.createTransport) {
      return Promise.reject(
        new Error(this.lastError ?? '[ChessEngineService] Unavailable.'),
      );
    }
    if (!this.readyPromise) {
      this.setStatus('loading');
      this.readyPromise = this.boot().catch((err) => {
        this.readyPromise = null;
        this.lastError = err instanceof Error ? err.message : String(err);
        this.setStatus('error');
        throw err;
      });
    }
    return this.readyPromise;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.pending) {
      const p = this.pending;
      this.clearPendingTimeout(p);
      this.pending = null;
      p.reject(new Error('[ChessEngineService] Destroyed during analysis.'));
    }
    this.notifyStopWaiters();
    this.disposeTransport();
    this.readyPromise = null;
    this.setStatus(this.createTransport ? 'uninitialized' : 'unavailable');
  }

  /**
   * Cancel the active search and wait (bounded) for UCI termination.
   * Cancelled pending resolves with `cancelled: true` — never a fake full eval.
   */
  async stop(): Promise<void> {
    await this.settleActiveSearch({ cancel: true });
    if (this.status === 'thinking') this.setStatus('ready');
  }

  private notifyStopWaiters(): void {
    const waiters = [...this.stopWaiters];
    this.stopWaiters.clear();
    for (const w of waiters) w();
  }

  private waitForSearchEnd(timeoutMs: number): Promise<void> {
    if (!this.pending) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.stopWaiters.delete(finish);
        clearTimeout(timer);
        resolve();
      };
      this.stopWaiters.add(finish);
      const timer = setTimeout(finish, timeoutMs);
    });
  }

  private async settleActiveSearch(options: {
    cancel: boolean;
  }): Promise<void> {
    const pending = this.pending;
    if (!pending) {
      if (this.transport && this.status !== 'unavailable') {
        try {
          this.transport.send('stop');
        } catch {
          /* ignore */
        }
      }
      return;
    }

    if (options.cancel) {
      pending.cancelled = true;
    }

    if (this.transport && this.status !== 'unavailable') {
      try {
        this.transport.send('stop');
      } catch {
        /* ignore */
      }
    }

    await this.waitForSearchEnd(STOP_WAIT_MS);

    // Bounded recovery: if bestmove never arrived, force-settle as cancelled.
    if (this.pending === pending) {
      this.clearPendingTimeout(pending);
      this.pending = null;
      pending.resolve(cancelledAnalysis());
      this.notifyStopWaiters();
    }
  }

  async analyzePosition(options: AnalyzePositionOptions): Promise<EngineAnalysis> {
    await this.init();
    if (!this.transport || this.destroyed) {
      throw new Error('[ChessEngineService] Not ready.');
    }

    // One search at a time: fully settle the previous epoch first.
    await this.settleActiveSearch({ cancel: true });

    const movetime = options.movetimeMs ?? this.defaultMoveTimeMs;
    const multiPv = Math.max(1, Math.round(options.multiPv ?? 1));
    const depth =
      options.depth != null && options.depth > 0
        ? Math.round(options.depth)
        : null;
    const epoch = ++this.searchEpoch;
    this.setStatus('thinking');

    if (multiPv !== this.activeMultiPv) {
      this.transport.send(`setoption name MultiPV value ${multiPv}`);
      this.activeMultiPv = multiPv;
    }

    return new Promise<EngineAnalysis>((resolve, reject) => {
      const pending: PendingAnalysis = {
        epoch,
        resolve: (result) => {
          if (this.status === 'thinking') this.setStatus('ready');
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            const bm = result.bestMove?.uci ?? '—';
            const evalLabel = result.cancelled
              ? 'cancelled'
              : result.score?.type === 'mate'
                ? `mate ${result.score.value}`
                : `${(result.scoreCp / 100).toFixed(2)}`;
            console.log(
              `[ChessEngineService] Engine: Stockfish | depth ${result.depth} | eval ${evalLabel} | best ${bm} | multipv ${result.lines?.length ?? 1}`,
            );
          }
          resolve(result);
        },
        reject: (err) => {
          this.lastError = err.message;
          this.setStatus('error');
          reject(err);
        },
        fen: options.fen,
        latest: null,
        linesByPv: new Map(),
        multiPv,
        timeout: null,
        cancelled: false,
      };
      pending.timeout = setTimeout(() => {
        if (this.pending?.epoch !== epoch) return;
        this.pending = null;
        try {
          this.transport?.send('stop');
        } catch {
          /* ignore */
        }
        pending.reject(new Error('[ChessEngineService] Analysis timed out.'));
        this.notifyStopWaiters();
      }, this.analysisTimeoutMs);

      this.pending = pending;
      this.transport!.send(`position fen ${options.fen}`);
      // Respect both depth and time budget (UCI: stop at whichever comes first).
      if (depth != null && movetime > 0) {
        this.transport!.send(`go depth ${depth} movetime ${movetime}`);
      } else if (depth != null) {
        this.transport!.send(`go depth ${depth}`);
      } else {
        this.transport!.send(`go movetime ${movetime}`);
      }
    });
  }

  async getBestMove(options: AnalyzePositionOptions): Promise<EngineBestMove | null> {
    const analysis = await this.analyzePosition(options);
    if (analysis.cancelled) return null;
    return analysis.bestMove;
  }

  async analyze(fen: string, movetimeMs?: number): Promise<EngineAnalysis> {
    return this.analyzePosition({ fen, movetimeMs });
  }

  private clearPendingTimeout(p: PendingAnalysis): void {
    if (p.timeout != null) {
      clearTimeout(p.timeout);
      p.timeout = null;
    }
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

  private settlePendingWithBestmove(line: string): void {
    const pending = this.pending;
    if (!pending) return;
    // Epoch check: a late bestmove after we already force-settled must not
    // attach to a newer pending (pending would be different object/epoch).
    this.pending = null;
    this.clearPendingTimeout(pending);
    this.notifyStopWaiters();

    if (pending.cancelled) {
      pending.resolve(cancelledAnalysis());
      return;
    }

    const uci = parseBestMove(line);
    const pv1 = pending.linesByPv.get(1) ?? pending.latest;
    const bestMove = resolveLegalBestMove(
      pending.fen,
      uci,
      pv1?.pvMove ?? null,
    );
    const lines = [...pending.linesByPv.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rank, snap]) => {
        const legalPv = filterLegalPv(pending.fen, snap.pv ?? []);
        return {
          multipv: rank,
          scoreCp: snap.scoreCp,
          mateIn: snap.mateIn,
          wdl: snap.wdl,
          depth: snap.depth,
          bestMove: resolveLegalBestMove(
            pending.fen,
            null,
            legalPv[0] ?? snap.pvMove,
          ),
          pv: legalPv.length > 0 ? legalPv : snap.pv ?? [],
        };
      })
      .filter((l) => l.bestMove != null || l.pv.length > 0 || l.multipv === 1);

    pending.resolve(snapshotToAnalysis(pv1, bestMove, lines));
  }

  private boot(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.createTransport) {
        reject(new Error('[ChessEngineService] No UCI transport.'));
        return;
      }
      let transport: UciTransport;
      try {
        transport = this.createTransport(this.enginePath);
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
        if (this.destroyed || this.status === 'ready') return;
        failBoot(new Error('[ChessEngineService] Boot timeout.'));
      }, this.bootTimeoutMs);

      const bootStartedAt =
        typeof __DEV__ !== 'undefined' && __DEV__ ? Date.now() : 0;

      const onLine = (line: string) => {
        if (this.destroyed || this.transport !== transport) return;

        if (this.status === 'loading' || this.status === 'uninitialized') {
          if (line.startsWith('uciok')) {
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              console.log('[Stockfish] uciok received');
            }
            for (const cmd of fullStrengthAnalysisOptionCommands(1)) {
              transport.send(cmd);
            }
            transport.send('isready');
            return;
          }
          if (line.startsWith('readyok')) {
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              console.log('[Stockfish] readyok received');
              console.log(
                '[Stockfish] boot duration:',
                Date.now() - bootStartedAt,
                'ms',
              );
            }
            this.clearBootTimeout();
            this.setStatus('ready');
            resolve();
            return;
          }
        }

        if (this.pending && line.startsWith('info ')) {
          if (this.pending.cancelled) return;
          const snap = parseInfoScoreSnapshot(line);
          if (snap) {
            this.pending.linesByPv.set(snap.multipv, snap);
            if (snap.multipv === 1 || !this.pending.latest) {
              this.pending.latest = snap;
            } else if (
              this.pending.latest.multipv !== 1 &&
              snap.depth >= this.pending.latest.depth
            ) {
              this.pending.latest = snap;
            }
          }
          return;
        }

        if (line.startsWith('bestmove')) {
          if (!this.pending) {
            // Orphan bestmove from a search we already force-settled — ignore.
            return;
          }
          this.settlePendingWithBestmove(line);
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
            reject(new Error('[ChessEngineService] Destroyed before start.'));
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

/** Deterministic mock for unit tests (no WASM). */
export function createMockChessEngineService(
  handler: (fen: string) => EngineAnalysis | Promise<EngineAnalysis>,
): Pick<
  ChessEngineService,
  | 'analyze'
  | 'analyzePosition'
  | 'getBestMove'
  | 'destroy'
  | 'getStatus'
  | 'isAvailable'
  | 'stop'
> {
  return {
    getStatus: () => 'ready' as EngineStatus,
    isAvailable: async () => true,
    stop: async () => undefined,
    destroy: () => undefined,
    analyze: async (fen) => Promise.resolve(handler(fen)),
    analyzePosition: async (opts) => Promise.resolve(handler(opts.fen)),
    getBestMove: async (opts) => {
      const a = await Promise.resolve(handler(opts.fen));
      return a.cancelled ? null : a.bestMove;
    },
  };
}

export { AnalysisCancelledError };
