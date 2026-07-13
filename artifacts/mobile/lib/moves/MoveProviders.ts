/**
 * Move-source providers used by Opening Game Mode.
 *
 * Kept separate from UI / GameContext so repertoire selection and Stockfish
 * can be composed, tested, and later swapped (e.g. native Stockfish) without
 * touching screens.
 */
import type { Chess, Move } from 'chess.js';
import type { ChessEngine } from '@/lib/engine';
import {
  chooseRepertoireMove,
  movesForPosition,
  type ParsedRepertoire,
  type RepertoireMoveChoice,
  type RepertoireSelectionSettings,
} from '@/lib/repertoire';

export interface MoveProvider {
  pickMove(game: Chess): Promise<Move | null>;
  cancel?(): void;
  newGame?(): void;
  init?(): Promise<void>;
  destroy?(): void;
}

/** Selects opponent moves from a merged repertoire tree. */
export class OpeningMoveProvider implements MoveProvider {
  constructor(
    private repertoire: ParsedRepertoire,
    private settings: RepertoireSelectionSettings = { mode: 'uniform-random' },
  ) {}

  setRepertoire(repertoire: ParsedRepertoire): void {
    this.repertoire = repertoire;
  }

  /** All book moves for a FEN, or empty when out of book. */
  choices(fen: string): RepertoireMoveChoice[] {
    return movesForPosition(this.repertoire, fen);
  }

  /** Whether `uci` is a repertoire continuation from `fen`. */
  includesMove(fen: string, uci: string): boolean {
    return this.choices(fen).some((m) => m.uci === uci);
  }

  async pickMove(game: Chess): Promise<Move | null> {
    const fen = game.fen();
    const choice = chooseRepertoireMove(this.repertoire, fen, this.settings);
    if (!choice) return null;

    const legal = game.moves({ verbose: true }) as Move[];
    return (
      legal.find(
        (m) =>
          m.from === choice.from &&
          m.to === choice.to &&
          (m.promotion ?? undefined) === (choice.promotion ?? undefined),
      ) ?? null
    );
  }
}

/** Thin adapter: ChessEngine → MoveProvider. */
export class StockfishMoveProvider implements MoveProvider {
  constructor(private engine: ChessEngine) {}

  async init(): Promise<void> {
    await this.engine.init?.();
  }

  async pickMove(game: Chess): Promise<Move | null> {
    return (await this.engine.pickMove(game)) ?? null;
  }

  cancel(): void {
    this.engine.cancel?.();
  }

  newGame(): void {
    this.engine.newGame?.();
  }

  destroy(): void {
    this.engine.destroy?.();
  }
}
