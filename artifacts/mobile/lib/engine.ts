/**
 * Chess engine interface.
 *
 * Modular design — swap in Stockfish, Opening Trainer, or any other
 * back-end without touching game logic. The rest of the app (GameContext,
 * UI, voice, board) only ever talks to this interface, never to a concrete
 * engine, so the underlying implementation can be replaced freely (e.g. a
 * web Web-Worker Stockfish today, a native Android engine tomorrow).
 *
 * Concrete implementations currently live in:
 *   - engines/random.ts            → RandomEngine  (built-in fallback opponent)
 *   - engines/stockfish/           → StockfishEngine (real engine, web today)
 *
 * The engine to use is chosen by `engines/index.ts::createOpponentEngine()`,
 * which is the single place that knows about platforms and concrete engines.
 *
 * ── Future move-source composition ──────────────────────────────────────────
 * Modes such as the Opening Trainer need another move source to temporarily
 * choose moves before handing control back to Stockfish. Because a
 * `ChessEngine` is just "given a position, produce a move", a composite engine
 * (e.g. `RepertoireEngine`) can itself implement `ChessEngine`, consult a
 * repertoire first, and delegate to a wrapped fallback engine when the
 * position leaves the repertoire — all without any change to GameContext or
 * the UI. See `lib/repertoire/` for the independent repertoire building block.
 */
import type { Chess } from 'chess.js';
import type { Move } from 'chess.js';

export interface ChessEngine {
  /**
   * Called once when the engine is first activated.
   * Use to initialise WebAssembly, spawn a worker, open a socket, etc.
   * Implementations must be idempotent (safe to call more than once).
   */
  init?(): Promise<void>;

  /**
   * Return the engine's chosen move for the current position,
   * or null if the game is over / no legal moves.
   *
   * Implementations MUST NOT mutate the passed `game`; they should read
   * `game.fen()` and reason on a private clone. GameContext applies the
   * returned move to the live game itself.
   */
  pickMove(game: Chess): Promise<Move | null>;

  /**
   * Abort any in-flight `pickMove` computation. The pending promise should
   * resolve to `null` (rather than reject). Called when the player undoes a
   * move, starts a new game, or switches colour while the engine is thinking.
   */
  cancel?(): void;

  /**
   * Signal that a brand-new game has started, so the engine can reset any
   * per-game internal state (transposition tables, hash, etc.). This must NOT
   * be called on undo — undo stays within the same game.
   */
  newGame?(): void;

  /**
   * Release any resources (threads, workers, sockets, WASM memory).
   * Called when the engine is swapped out or the app unmounts.
   */
  destroy?(): void;
}
