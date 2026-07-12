/**
 * StockfishEngine — a `ChessEngine` backed by the Stockfish UCI engine.
 *
 * Platform-agnostic: it drives the engine purely over a `UciTransport`, so the
 * exact same orchestration runs on web today (Web Worker) and could run on a
 * native transport later without changes.
 *
 * Strength: pinned to ~1800 Elo via `UCI_LimitStrength` + `UCI_Elo` (see
 * uci.ts). This is Stockfish's dedicated human-strength model, which produces
 * a far more consistent and natural opponent than capping search depth.
 *
 * Concurrency: at most one search runs at a time. GameContext serialises
 * turns, and `cancel()` cleanly aborts an in-flight search (resolving its
 * promise to null) when the player undoes / starts a new game / switches
 * colour while the engine is thinking.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { ChessEngine } from '../../engine';
import { createUciTransport } from './transport';
import type { StockfishConfig, UciTransport } from './types';
import {
  chooseVariedMove,
  DEFAULT_STOCKFISH_CONFIG,
  parseBestMove,
  parseInfoLine,
  setupOptionCommands,
  type CandidateLine,
} from './uci';

interface PendingSearch {
  resolve: (move: Move | null) => void;
  legalMoves: Move[];
}

export class StockfishEngine implements ChessEngine {
  private readonly config: StockfishConfig;
  private transport: UciTransport | null = null;
  private readyPromise: Promise<void> | null = null;
  private isReady = false;
  private pending: PendingSearch | null = null;
  /** MultiPV candidate lines collected during the current search (keyed by rank). */
  private searchInfo = new Map<number, CandidateLine>();

  constructor(config: Partial<StockfishConfig> = {}) {
    this.config = { ...DEFAULT_STOCKFISH_CONFIG, ...config };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  init(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.boot().catch((err) => {
        // Allow a later retry if boot failed.
        this.readyPromise = null;
        throw err;
      });
    }
    return this.readyPromise;
  }

  private boot(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let transport: UciTransport;
      try {
        transport = createUciTransport(this.config.enginePath);
      } catch (err) {
        reject(err);
        return;
      }
      this.transport = transport;

      const timeout = setTimeout(() => {
        reject(new Error('[StockfishEngine] Timed out waiting for engine to become ready.'));
      }, 30_000);

      const onLine = (line: string) => {
        // Handshake progression.
        if (!this.isReady) {
          if (line.startsWith('uciok')) {
            for (const cmd of setupOptionCommands(this.config.elo, this.config.multiPv)) {
              transport.send(cmd);
            }
            transport.send('isready');
            return;
          }
          if (line.startsWith('readyok')) {
            this.isReady = true;
            clearTimeout(timeout);
            transport.send('ucinewgame');
            resolve();
            return;
          }
        }

        // Collect candidate lines while a search is running.
        if (this.pending && line.startsWith('info ')) {
          const info = parseInfoLine(line);
          if (info) this.searchInfo.set(info.multipv, info);
          return;
        }

        // Search results.
        if (line.startsWith('bestmove')) {
          this.resolvePending(line);
        }
      };

      transport
        .start(onLine)
        .then(() => {
          transport.send('uci');
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  }

  destroy(): void {
    this.cancel();
    try {
      this.transport?.send('quit');
    } catch {
      /* ignore */
    }
    this.transport?.terminate();
    this.transport = null;
    this.readyPromise = null;
    this.isReady = false;
  }

  // ── New game ────────────────────────────────────────────────────────────────

  newGame(): void {
    if (this.isReady && this.transport) {
      this.transport.send('ucinewgame');
      this.transport.send('isready');
    }
  }

  // ── Move selection ────────────────────────────────────────────────────────────

  async pickMove(game: Chess): Promise<Move | null> {
    await this.init();
    if (!this.transport) return null;
    if (game.isGameOver()) return null;

    // Reason on a private snapshot so we never depend on the live game being
    // mutated (e.g. by an undo) while the engine is thinking.
    const fen = game.fen();
    const snapshot = new Chess(fen);
    const legalMoves = snapshot.moves({ verbose: true }) as Move[];
    if (legalMoves.length === 0) return null;

    // Abort any lingering search (defensive — turns are serialised upstream).
    if (this.pending) {
      const stale = this.pending;
      this.pending = null;
      stale.resolve(null);
      this.transport.send('stop');
    }

    this.searchInfo = new Map();
    return new Promise<Move | null>((resolve) => {
      this.pending = { resolve, legalMoves };
      this.transport!.send(`position fen ${fen}`);
      this.transport!.send(`go movetime ${this.config.moveTimeMs}`);
    });
  }

  cancel(): void {
    if (this.pending) {
      const pending = this.pending;
      this.pending = null;
      pending.resolve(null);
    }
    if (this.isReady && this.transport) {
      this.transport.send('stop');
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private resolvePending(line: string): void {
    const pending = this.pending;
    if (!pending) return; // stale bestmove from an already-cancelled search
    this.pending = null;

    const candidates = [...this.searchInfo.values()];
    this.searchInfo = new Map();

    // Prefer a varied choice among near-best MultiPV candidates (adds opening
    // diversity); fall back to the plain bestmove when no candidate info was
    // reported or variety is disabled (multiPv <= 1).
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
