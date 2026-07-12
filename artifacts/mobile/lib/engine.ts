/**
 * Chess engine interface.
 *
 * Modular design — swap in Stockfish, Opening Trainer, or any other
 * back-end without touching game logic.  Only the RandomEngine is
 * implemented now; future engines drop in by implementing this interface.
 */
import type { Chess } from 'chess.js';
import type { Move } from 'chess.js';

export interface ChessEngine {
  /**
   * Called once when the engine is first activated.
   * Use to initialise WebAssembly, open a socket, etc.
   */
  init?(): Promise<void>;

  /**
   * Return the engine's chosen move for the current position,
   * or null if the game is over / no legal moves.
   */
  pickMove(game: Chess): Promise<Move | null>;

  /**
   * Release any resources (threads, sockets, WASM memory).
   * Called when the engine is swapped out or the app unmounts.
   */
  destroy?(): void;
}
