/**
 * Opening-mode opponent controller.
 *
 * While the game stays in the selected repertoire, moves come from
 * OpeningMoveProvider. The first time the player leaves the book — or the
 * repertoire naturally ends — control switches permanently to Stockfish for
 * the rest of that game (no accidental return on transposition).
 *
 * Theory-exit events are recorded with correct move numbering so the UI / PGN
 * exporter can announce and comment them distinctly:
 *   - player deviation → "Vous êtes sorti de la théorie au …"
 *   - repertoire end   → "Fin du répertoire après …"
 */
import type { Chess, Move } from 'chess.js';
import type { ChessEngine } from '@/lib/engine';
import type { ParsedRepertoire } from '@/lib/repertoire';
import { OpeningMoveProvider, StockfishMoveProvider } from './MoveProviders';

export type TheoryExitKind = 'player-deviation' | 'repertoire-end';

export interface TheoryExit {
  kind: TheoryExitKind;
  /** 0-based half-move index of the move that triggered the exit. */
  ply: number;
  san: string;
  /** Human-readable French message. */
  message: string;
  /** Compact PGN comment body (without braces). */
  pgnComment: string;
}

export type OpeningPhase = 'book' | 'engine';

/** Format a half-move as "5.e3" or "8...Fg7". */
export function formatNumberedSan(ply: number, san: string): string {
  const fullMove = Math.floor(ply / 2) + 1;
  const isWhite = ply % 2 === 0;
  return isWhite ? `${fullMove}.${san}` : `${fullMove}...${san}`;
}

function buildTheoryExit(
  kind: TheoryExitKind,
  ply: number,
  san: string,
): TheoryExit {
  const numbered = formatNumberedSan(ply, san);
  if (kind === 'player-deviation') {
    return {
      kind,
      ply,
      san,
      message: `Vous êtes sorti de la théorie au ${Math.floor(ply / 2) + 1}e coup avec ${numbered}.`,
      pgnComment: `Sortie du répertoire au ${Math.floor(ply / 2) + 1}e coup avec ${numbered}`,
    };
  }
  return {
    kind,
    ply,
    san,
    message: `Fin du répertoire après ${numbered}.`,
    pgnComment: `Fin du répertoire après ${numbered}`,
  };
}

export class OpeningOpponent {
  private phase: OpeningPhase = 'book';
  private theoryExit: TheoryExit | null = null;
  private readonly book: OpeningMoveProvider;
  private readonly engine: StockfishMoveProvider;

  constructor(repertoire: ParsedRepertoire, stockfish: ChessEngine) {
    this.book = new OpeningMoveProvider(repertoire);
    this.engine = new StockfishMoveProvider(stockfish);
  }

  async init(): Promise<void> {
    await this.engine.init?.();
  }

  destroy(): void {
    this.engine.destroy?.();
  }

  cancel(): void {
    this.engine.cancel?.();
  }

  newGame(): void {
    this.phase = 'book';
    this.theoryExit = null;
    this.engine.newGame?.();
  }

  getPhase(): OpeningPhase {
    return this.phase;
  }

  getTheoryExit(): TheoryExit | null {
    return this.theoryExit;
  }

  /**
   * After a successful player move: detect deviation from the repertoire.
   * `beforeFen` is the position BEFORE the player's move.
   * Returns a theory-exit message to announce, or null if still in book /
   * already out of book.
   */
  onPlayerMove(beforeFen: string, played: Move, plyAfterMove: number): string | null {
    if (this.phase !== 'book') return null;

    const uci = `${played.from}${played.to}${played.promotion ?? ''}`;
    if (this.book.includesMove(beforeFen, uci)) {
      return null;
    }

    const exit = buildTheoryExit('player-deviation', plyAfterMove - 1, played.san);
    this.theoryExit = exit;
    this.phase = 'engine';
    return exit.message;
  }

  /**
   * Restore book mode when undoing past the theory-exit ply.
   * `remainingPlyCount` is history.length after the undo.
   */
  onUndo(remainingPlyCount: number): void {
    if (this.theoryExit && remainingPlyCount <= this.theoryExit.ply) {
      this.theoryExit = null;
      this.phase = 'book';
    }
    this.engine.cancel?.();
  }

  /**
   * Opponent's turn. Uses repertoire while in book; switches to Stockfish
   * when the book has no move (natural repertoire end) or after a deviation.
   */
  async pickMove(
    game: Chess,
  ): Promise<{ move: Move | null; theoryMessage: string | null }> {
    if (this.phase === 'book') {
      const bookMove = await this.book.pickMove(game);
      if (bookMove) {
        return { move: bookMove, theoryMessage: null };
      }

      // Book ran out on the opponent's turn while the player followed theory.
      const history = game.history();
      const lastSan = history[history.length - 1] ?? '?';
      const lastPly = history.length - 1;
      const exit = buildTheoryExit('repertoire-end', Math.max(0, lastPly), lastSan);
      this.theoryExit = exit;
      this.phase = 'engine';
      const engineMove = await this.engine.pickMove(game);
      return { move: engineMove, theoryMessage: exit.message };
    }

    return { move: await this.engine.pickMove(game), theoryMessage: null };
  }
}
