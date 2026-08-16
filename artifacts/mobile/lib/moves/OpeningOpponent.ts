/**
 * OpeningOpponent — repertoire book replies, then optional Stockfish handoff.
 *
 * Explicit training phases (do not collapse line-complete into deviation):
 *   playingTheory → lineComplete | outOfTheory → engineContinuation
 */
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

/** Explicit opening-training UI state. */
export type OpeningTrainingState =
  | 'playingTheory'
  | 'lineComplete'
  | 'outOfTheory'
  | 'engineContinuation';

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

/** Internal opponent phase (maps 1:1 onto OpeningTrainingState). */
export type OpeningPhase =
  | 'book'
  | 'lineComplete'
  | 'outOfTheory'
  | 'engine';

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
      message: tMsg('openings.leftTheory'),
      pgnComment: `Sortie du répertoire avec ${numbered}`,
      analysis,
    };
  }
  return {
    kind,
    ply,
    san,
    message: tMsg('openings.endOfTheoreticalLine'),
    pgnComment: `Fin de la ligne théorique importée après ${numbered}`,
  };
}

export function trainingStateFromPhase(phase: OpeningPhase): OpeningTrainingState {
  switch (phase) {
    case 'lineComplete':
      return 'lineComplete';
    case 'outOfTheory':
      return 'outOfTheory';
    case 'engine':
      return 'engineContinuation';
    case 'book':
    default:
      return 'playingTheory';
  }
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

  getTrainingState(): OpeningTrainingState {
    return trainingStateFromPhase(this.phase);
  }

  getTheoryExit(): TheoryExit | null {
    return this.theoryExit;
  }

  getRepertoire(): ParsedRepertoire {
    return this.repertoire;
  }

  /**
   * User chose to keep the current board and play vs the engine.
   * Preserves position; only flips phase to engine.
   */
  continueVsEngine(): void {
    if (this.phase === 'engine') return;
    this.phase = 'engine';
  }

  /**
   * After a successful player move: detect deviation from the repertoire.
   * Does NOT start engine play — caller must pause on outOfTheory.
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
    this.phase = 'outOfTheory';
    return exit.message;
  }

  onUndo(remainingPlyCount: number): void {
    if (
      this.theoryExit &&
      (this.phase === 'outOfTheory' || this.phase === 'engine' || this.phase === 'lineComplete') &&
      remainingPlyCount <= this.theoryExit.ply
    ) {
      this.theoryExit = null;
      this.phase = 'book';
    }
    this.engine.cancel?.();
  }

  /** Clear deviation and return to book (after undoing the off-book move). */
  returnToTheory(): void {
    this.theoryExit = null;
    this.phase = 'book';
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

      // End of theoretical line at this node — pause; do not auto-play Stockfish.
      const history = game.history();
      const lastSan = history[history.length - 1] ?? '?';
      const lastPly = history.length - 1;
      const exit = buildTheoryExit('repertoire-end', Math.max(0, lastPly), lastSan);
      this.theoryExit = exit;
      this.phase = 'lineComplete';
      return { move: null, theoryMessage: exit.message };
    }

    if (this.phase === 'lineComplete' || this.phase === 'outOfTheory') {
      return { move: null, theoryMessage: this.theoryExit?.message ?? null };
    }

    return { move: await this.engine.pickMove(game), theoryMessage: null };
  }
}
