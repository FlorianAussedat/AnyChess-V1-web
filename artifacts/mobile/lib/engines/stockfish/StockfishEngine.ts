/**
 * StockfishEngine — a `ChessEngine` backed by the Stockfish UCI engine.
 *
 * Platform-agnostic: it drives the engine purely over a `UciTransport`.
 * Web uses a Worker; Android uses the native process via `createUciTransport`.
 *
 * Strength (human Elo): `UCI_LimitStrength` + `UCI_Elo` only. The process
 * stays alive for the whole screen session — new games send `ucinewgame`,
 * level changes send `setoption`. Analysis uses a different service and
 * never inherits these options.
 *
 * One search at a time. `stop` finishes the previous search before the next
 * `position`/`go`, and a generation id drops a late `bestmove`.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { ChessEngine } from '../../engine';
import { DEFEND_DRAW_ENGINE_CONFIG } from '../../defendDraw/engineConfig.ts';
import { subscribeAndroidAppState } from './androidAppState.ts';
import type { StockfishConfig, UciTransport } from './types';
import { getStockfishWorkerUrl } from './workerUrl.ts';
import {
  chooseVariedMove,
  DEFAULT_STOCKFISH_CONFIG,
  FLOOR_VARIETY_MOVETIME_MS,
  gameGoCommand,
  humanEloSearchLimit,
  observeUciOptionLine,
  parseBestMove,
  parseInfoLine,
  setupOptionCommands,
  type CandidateLine,
} from './uci.ts';

interface PendingSearch {
  id: number;
  resolve: (move: Move | null) => void;
  legalMoves: Move[];
  timeoutId: ReturnType<typeof setTimeout> | null;
  startedAt: number;
}

interface LineWaiter {
  pred: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (err: Error) => void;
}

/** Extra ms beyond the go budget before we abort a hung search. */
const SEARCH_TIMEOUT_SLACK_MS = 2500;
const HANDSHAKE_STEP_MS = 8000;
const WARMUP_MS = 4000;

function devLog(message: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[Stockfish] ${message}`);
  }
}

export interface StockfishEngineDeps {
  createTransport?: (enginePath: string) => UciTransport;
}

export class StockfishEngine implements ChessEngine {
  private config: StockfishConfig;
  private readonly injectedTransport: ((enginePath: string) => UciTransport) | null;
  private transport: UciTransport | null = null;
  private bootPromise: Promise<void> | null = null;
  private operation: Promise<void> = Promise.resolve();
  private isReady = false;
  private destroyed = false;
  private bootTimeout: ReturnType<typeof setTimeout> | null = null;
  private pending: PendingSearch | null = null;
  private searchInfo = new Map<number, CandidateLine>();
  private searchId = 0;
  private expectDiscardedBestmove = 0;
  private discardWaiters: Array<() => void> = [];
  private lineWaiter: LineWaiter | null = null;
  /** Handshake lines that arrived before the waiter was armed (sync transports). */
  private unread: string[] = [];
  private unbindAppState: (() => void) | null = null;
  private hadBooted = false;
  private bootOrigin = 0;
  /** Options last acknowledged by the engine, so a no-op level change is free. */
  private appliedElo: number | null = null;
  private appliedMultiPv: number | null = null;

  constructor(config: Partial<StockfishConfig> = {}, deps?: StockfishEngineDeps) {
    this.config = { ...DEFAULT_STOCKFISH_CONFIG, ...config };
    this.injectedTransport = deps?.createTransport ?? null;
    this.unbindAppState = subscribeAndroidAppState((state) => {
      if (this.destroyed) return;
      if (state === 'background') {
        this.cancel();
      } else if (state === 'active') {
        void this.recoverAfterBackground();
      }
    });
  }

  private runExclusive<T>(op: () => Promise<T>): Promise<T> {
    const run = this.operation.then(op, op);
    this.operation = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  init(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('[StockfishEngine] Cannot init after destroy().'));
    }
    if (!this.bootPromise) {
      this.bootPromise = this.boot().catch((err) => {
        this.bootPromise = null;
        throw err;
      });
    }
    return this.bootPromise;
  }

  applyStrength(partial: Partial<StockfishConfig>): Promise<void> {
    this.config = { ...this.config, ...partial };
    if (!this.bootPromise) return Promise.resolve();
    return this.runExclusive(async () => {
      await this.init();
      await this.syncOptions();
    });
  }

  newGame(): Promise<void> {
    return this.runExclusive(async () => {
      await this.init();
      if (!this.isReady || !this.transport || this.destroyed) return;
      await this.waitUntilIdleSearch();
      this.transport.send('ucinewgame');
      this.transport.send('isready');
      await this.waitFor((line) => line.startsWith('readyok'), HANDSHAKE_STEP_MS);
    });
  }

  async pickMove(game: Chess): Promise<Move | null> {
    return this.runExclusive(() => this.performSearch(game));
  }

  private async performSearch(game: Chess): Promise<Move | null> {
    await this.init();
    if (!this.transport || this.destroyed || !this.isReady) return null;
    if (game.isGameOver()) return null;

    const fen = game.fen();
    const snapshot = new Chess(fen);
    const legalMoves = snapshot.moves({ verbose: true }) as Move[];
    if (legalMoves.length === 0) return null;

    await this.waitUntilIdleSearch();
    if (this.destroyed) return null;

    const myId = ++this.searchId;
    if (legalMoves.length === 1) {
      devLog(`search start elo=${this.config.elo}`);
      devLog('bestmove +0ms');
      return legalMoves[0] ?? null;
    }

    const go = gameGoCommand(this.config);
    const movetimeMs =
      this.config.multiPv > 1
        ? FLOOR_VARIETY_MOVETIME_MS
        : humanEloSearchLimit(this.config.elo).movetimeMs;
    devLog(`search start elo=${this.config.elo}`);
    const startedAt = Date.now();

    return new Promise<Move | null>((resolve) => {
      if (this.searchId !== myId || this.destroyed) {
        resolve(null);
        return;
      }
      const timeoutId = setTimeout(() => {
        if (this.pending?.id !== myId) return;
        this.pending = null;
        this.searchInfo = new Map();
        this.expectDiscardedBestmove += 1;
        try {
          this.transport?.send('stop');
        } catch {
          /* ignore */
        }
        resolve(null);
      }, movetimeMs + SEARCH_TIMEOUT_SLACK_MS);
      this.pending = { id: myId, resolve, legalMoves, timeoutId, startedAt };
      this.searchInfo = new Map();
      this.transport!.send(`position fen ${fen}`);
      this.transport!.send(go);
    });
  }

  cancel(): void {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    this.searchId += 1;
    if (pending.timeoutId != null) clearTimeout(pending.timeoutId);
    pending.resolve(null);
    this.searchInfo = new Map();
    if (this.transport) {
      this.expectDiscardedBestmove += 1;
      try {
        this.transport.send('stop');
      } catch {
        /* ignore */
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.hadBooted = false;
    this.unbindAppState?.();
    this.unbindAppState = null;
    this.cancel();
    this.rejectWaiter(new Error('[StockfishEngine] Destroyed.'));
    this.disposeTransport();
    this.bootPromise = null;
    this.isReady = false;
  }

  /**
   * Native process is killed in background. Re-boot if this opponent
   * is still owned by the Classic / Opening screen.
   */
  async recoverAfterBackground(): Promise<void> {
    if (this.destroyed || !this.hadBooted) return;
    this.cancel();
    this.disposeTransport();
    this.bootPromise = null;
    this.isReady = false;
    this.appliedElo = null;
    this.appliedMultiPv = null;
    try {
      await this.init();
    } catch {
      /* next pickMove will retry */
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

  private async openTransport(enginePath: string): Promise<UciTransport> {
    if (this.injectedTransport) return this.injectedTransport(enginePath);
    const { createUciTransport } = await import('./transport');
    return createUciTransport(enginePath);
  }

  private boot(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.destroyed) {
        reject(new Error('[StockfishEngine] Cannot boot after destroy().'));
        return;
      }

      const failBoot = (error: Error) => {
        this.rejectWaiter(error);
        if (this.transport) this.disposeTransport();
        reject(error);
      };

      this.bootOrigin = Date.now();
      this.bootTimeout = setTimeout(() => {
        this.bootTimeout = null;
        if (this.destroyed || this.isReady) return;
        failBoot(new Error('[StockfishEngine] Timed out waiting for engine to become ready.'));
      }, DEFEND_DRAW_ENGINE_CONFIG.bootTimeoutMs);

      let useWebWorker = false;
      if (!this.injectedTransport) {
        try {
          const { Platform } = require('react-native') as { Platform: { OS: string } };
          useWebWorker = Platform.OS === 'web';
        } catch {
          useWebWorker = false;
        }
      }
      const enginePath = useWebWorker ? getStockfishWorkerUrl() : this.config.enginePath;

      void this.openTransport(enginePath)
        .then(async (transport) => {
          if (this.destroyed) {
            try {
              transport.terminate();
            } catch {
              /* ignore */
            }
            failBoot(new Error('[StockfishEngine] Destroyed before worker start completed.'));
            return;
          }
          this.transport = transport;
          await transport.start((line) => this.onLine(line));
          if (this.destroyed || this.transport !== transport) {
            failBoot(new Error('[StockfishEngine] Destroyed before worker start completed.'));
            return;
          }
          devLog(`engine created +${Date.now() - this.bootOrigin}ms`);
          transport.send('uci');
          await this.waitFor((line) => line.startsWith('uciok'), HANDSHAKE_STEP_MS);
          devLog(`uciok +${Date.now() - this.bootOrigin}ms`);
          this.sendStrengthOptions();
          transport.send('isready');
          await this.waitFor((line) => line.startsWith('readyok'), HANDSHAKE_STEP_MS);
          devLog(`readyok +${Date.now() - this.bootOrigin}ms`);
          await this.warmUp();
          transport.send('ucinewgame');
          transport.send('isready');
          await this.waitFor((line) => line.startsWith('readyok'), HANDSHAKE_STEP_MS);
          if (this.destroyed || this.transport !== transport) {
            failBoot(new Error('[StockfishEngine] Destroyed before engine became ready.'));
            return;
          }
          this.isReady = true;
          this.hadBooted = true;
          this.clearBootTimeout();
          resolve();
        })
        .catch((err) => {
          if (this.isReady) return;
          failBoot(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  private sendStrengthOptions(): void {
    if (!this.transport) return;
    for (const cmd of setupOptionCommands(this.config.elo, this.config.multiPv)) {
      this.transport.send(cmd);
    }
    this.appliedElo = this.config.elo;
    this.appliedMultiPv = this.config.multiPv;
  }

  private async syncOptions(): Promise<void> {
    if (!this.isReady || !this.transport || this.destroyed) return;
    if (this.appliedElo === this.config.elo && this.appliedMultiPv === this.config.multiPv) {
      return;
    }
    await this.waitUntilIdleSearch();
    this.sendStrengthOptions();
    this.transport.send('isready');
    await this.waitFor((line) => line.startsWith('readyok'), HANDSHAKE_STEP_MS);
  }

  /** Depth-1 search while the player is still choosing a side, so the first real go is hot. */
  private async warmUp(): Promise<void> {
    if (!this.transport || this.destroyed) return;
    const started = Date.now();
    this.transport.send('position startpos');
    this.transport.send('go depth 1 movetime 200');
    try {
      await this.waitFor((line) => line.startsWith('bestmove'), WARMUP_MS);
      devLog(`warmup +${Date.now() - started}ms`);
    } catch {
      this.expectDiscardedBestmove += 1;
      try {
        this.transport.send('stop');
      } catch {
        /* ignore */
      }
      try {
        await this.waitFor((line) => line.startsWith('bestmove'), 500);
      } catch {
        this.expectDiscardedBestmove = Math.max(0, this.expectDiscardedBestmove - 1);
      }
      devLog(`warmup skipped +${Date.now() - started}ms`);
    }
  }

  private waitUntilIdleSearch(): Promise<void> {
    if (this.expectDiscardedBestmove <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.expectDiscardedBestmove = 0;
        resolve();
      }, 500);
      this.discardWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private flushDiscardWaiters(): void {
    const waiters = this.discardWaiters;
    this.discardWaiters = [];
    for (const waiter of waiters) waiter();
  }

  private waitFor(pred: (line: string) => boolean, timeoutMs: number): Promise<string> {
    const bufferedAt = this.unread.findIndex(pred);
    if (bufferedAt >= 0) {
      const [line] = this.unread.splice(bufferedAt, 1);
      return Promise.resolve(line!);
    }
    if (this.lineWaiter) {
      return Promise.reject(new Error('[StockfishEngine] Overlapping UCI wait.'));
    }
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.lineWaiter?.resolve === resolve) this.lineWaiter = null;
        reject(new Error('[StockfishEngine] Timed out waiting for engine line.'));
      }, timeoutMs);
      this.lineWaiter = {
        pred,
        resolve: (line) => {
          clearTimeout(timer);
          resolve(line);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };
    });
  }

  private rejectWaiter(err: Error): void {
    const waiter = this.lineWaiter;
    this.lineWaiter = null;
    waiter?.reject(err);
  }

  private onLine(line: string): void {
    if (this.destroyed) return;
    observeUciOptionLine(line);

    if (this.lineWaiter?.pred(line)) {
      const waiter = this.lineWaiter;
      this.lineWaiter = null;
      waiter.resolve(line);
      return;
    }

    if (line.startsWith('bestmove')) {
      if (this.expectDiscardedBestmove > 0) {
        this.expectDiscardedBestmove -= 1;
        if (this.expectDiscardedBestmove === 0) this.flushDiscardWaiters();
        return;
      }
      if (this.pending) {
        this.resolvePending(line);
        return;
      }
      this.unread.push(line);
      if (this.unread.length > 8) this.unread.shift();
      return;
    }

    if (this.pending && line.startsWith('info ')) {
      const info = parseInfoLine(line);
      if (info) this.searchInfo.set(info.multipv, info);
      return;
    }

    if (
      line.startsWith('uciok') ||
      line.startsWith('readyok') ||
      line.startsWith('bestmove')
    ) {
      this.unread.push(line);
      if (this.unread.length > 8) this.unread.shift();
    }
  }

  private resolvePending(line: string): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    if (pending.timeoutId != null) clearTimeout(pending.timeoutId);
    devLog(`bestmove +${Date.now() - pending.startedAt}ms`);

    const candidates = [...this.searchInfo.values()];
    this.searchInfo = new Map();

    const variedUci =
      this.config.multiPv > 1
        ? chooseVariedMove(candidates, this.config.varietyMarginCp)
        : null;

    const uci = variedUci
      ? {
          from: variedUci.slice(0, 2),
          to: variedUci.slice(2, 4),
          promotion: variedUci.length > 4 ? variedUci[4].toLowerCase() : undefined,
        }
      : parseBestMove(line);

    if (!uci) {
      pending.resolve(null);
      return;
    }
    const move =
      pending.legalMoves.find(
        (m) =>
          m.from === uci.from &&
          m.to === uci.to &&
          (!uci.promotion || m.promotion === uci.promotion),
      ) ?? null;
    pending.resolve(move);
  }
}
