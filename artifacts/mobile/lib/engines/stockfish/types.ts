/**
 * Platform-agnostic types for the Stockfish integration.
 *
 * The only platform-specific piece of the whole integration is the
 * `UciTransport`: a thin duplex channel that carries UCI text commands to a
 * Stockfish process and streams its text output back. Everything else
 * (handshake, option setup, Elo limiting, move selection) is shared code in
 * `StockfishEngine`.
 *
 * Web provides a Web-Worker transport (`transport.web.ts`). Native Android
 * provides a process-backed transport in `transport.ts` (`StockfishUci`).
 * AnyLyseur (G2) uses that transport via `createChessEngineService`. Classic (G3a)
 * uses it via `createOpponentEngine` → StockfishEngine. Opening play G3b waits
 * for Classic device validation. Endgames are not switched over.
 */

/** Duplex UCI channel to a Stockfish engine instance. */
export interface UciTransport {
  /**
   * Start the underlying engine process/worker. `onLine` is invoked once per
   * line of UCI output the engine emits. Resolves once the channel is created
   * (not necessarily once the engine finished loading — the UCI `uciok` /
   * `readyok` handshake tracks that).
   */
  start(onLine: (line: string) => void): Promise<void>;

  /** Send a single UCI command line to the engine. */
  send(command: string): void;

  /** Tear down the engine process/worker and free resources. */
  terminate(): void;
}

/** Tunable Stockfish parameters. */
export interface StockfishConfig {
  /**
   * Target playing strength in Elo, applied via `UCI_LimitStrength` +
   * `UCI_Elo`. Stockfish accepts roughly 1320–3190.
   */
  elo: number;

  /** Milliseconds Stockfish is allowed to think per move (`go movetime`). */
  moveTimeMs: number;

  /**
   * URL (web) or identifier (native) locating the engine. On web this is the
   * path to the worker script served from `public/`.
   */
  enginePath: string;

  /**
   * Number of candidate lines Stockfish reports (`MultiPV`). Values > 1 let us
   * choose among several strong moves so the opponent doesn't always repeat
   * the same opening. 1 disables move variety (single best move).
   */
  multiPv: number;

  /**
   * Centipawn margin for move variety: among the MultiPV candidates, any move
   * whose evaluation is within this many centipawns of the best is eligible to
   * be chosen (weighted toward the better ones). Larger = more variety but
   * slightly looser play. Ignored when multiPv <= 1.
   */
  varietyMarginCp: number;
}
