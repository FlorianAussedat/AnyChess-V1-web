import type { Chess, Move } from 'chess.js';
import type { ChessEngine } from '@/lib/engine';
import type { ParsedRepertoire } from '@/lib/repertoire';
import {
  analyzeDeviation,
  type DeviationAnalysis,
} from '@/lib/repertoire/RepertoireDeviationAnalyzer';
import { tMsg } from '@/lib/i18n';
import { formatNumberedSan } from './formatNumberedSan';
import { OpeningMoveProvider, StockfishMoveProvider } from './MoveProviders';

export type TheoryExitKind = 'player-deviation' | 'repertoire-end';
export { formatNumberedSan };

export interface TheoryExit {
  kind: TheoryExitKind;
  /** 0-based half-move index of the move that triggered the exit. */
  ply: number;
  san: string;
  /** Human-readable message (app language); numbered SAN stays English for TTS. */
  message: string;
  /** Compact PGN comment body (without braces). */
  pgnComment: string;
  /** Present only for player deviations. */
  analysis?: DeviationAnalysis;
}

export type OpeningPhase = 'book' | 'engine';

function buildTheoryExit(
  kind: TheoryExitKind,
  ply: number,
  san: string,
  analysis?: DeviationAnalysis,
): TheoryExit {
  const numbered = formatNumberedSan(ply, san);
  if (kind === 'player-deviation') {
    return {
      kind,
      ply,
      san,
      message: tMsg('openings.theoryDeviation', { move: numbered }),
      pgnComment: `Sortie du répertoire avec ${numbered}`,
      analysis,
    };
  }
  return {
    kind,
    ply,
    san,
    message: tMsg('openings.theoryComplete'),
    pgnComment: `Fin de la ligne théorique importée après ${numbered}`,
  };
}

export class OpeningOpponent {
  private phase: OpeningPhase = 'book';
  private theoryExit: TheoryExit | null = null;
  private readonly book: OpeningMoveProvider;
  private readonly engine: StockfishMoveProvider;
  private readonly repertoire: ParsedRepertoire;

  constructor(repertoire: ParsedRepertoire, stockfish: ChessEngine) {
    this.repertoire = repertoire;
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

    const deviationPly = plyAfterMove - 1;
    const analysis = analyzeDeviation(
      this.repertoire,
      beforeFen,
      played,
      deviationPly,
    );
    const exit = buildTheoryExit('player-deviation', deviationPly, played.san, analysis);
    this.theoryExit = exit;
    this.phase = 'engine';
    return exit.message;
  }

  onUndo(remainingPlyCount: number): void {
    if (this.theoryExit && remainingPlyCount <= this.theoryExit.ply) {
      this.theoryExit = null;
      this.phase = 'book';
    }
    this.engine.cancel?.();
  }

  async pickMove(
    game: Chess,
  ): Promise<{ move: Move | null; theoryMessage: string | null }> {
    if (this.phase === 'book') {
      const bookMove = await this.book.pickMove(game);
      if (bookMove) {
        return { move: bookMove, theoryMessage: null };
      }

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
