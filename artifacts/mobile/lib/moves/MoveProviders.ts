import { pickBalanced, trainingPaths } from '../continueLine/RepertoireBranchSelector';
import type { ContinueLinePath } from '../continueLine/types';
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
  private selectedPath: ContinueLinePath | null = null;
  private recent: string[] = [];

  newGame(): void { this.selectedPath = null; }

  constructor(
    private repertoire: ParsedRepertoire,
    private settings: RepertoireSelectionSettings = { mode: 'uniform-random' },
  ) {}

  setRepertoire(repertoire: ParsedRepertoire): void {
    this.repertoire = repertoire;
    this.selectedPath = null;
    this.recent = [];
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
    const history = game.history();
    const candidates = trainingPaths(this.repertoire).filter(path =>
      path.sans.length > history.length && history.every((san, index) => path.sans[index] === san) &&
      path.fensBefore[history.length]?.split(' ').slice(0, 4).join(' ') === fen.split(' ').slice(0, 4).join(' '));
    if (this.settings.mode === 'uniform-random' && !candidates.some(p => p.id === this.selectedPath?.id)) {
      this.selectedPath = pickBalanced(candidates, p => p.id, this.recent, this.settings.rng ?? Math.random);
      if (this.selectedPath) this.recent = [this.selectedPath.id, ...this.recent.filter(id => id !== this.selectedPath!.id)];
    }
    const choice = this.settings.mode === 'uniform-random' && this.selectedPath && candidates.some(p => p.id === this.selectedPath!.id)
      ? this.selectedPath.choices[history.length]
      : chooseRepertoireMove(this.repertoire, fen, this.settings);
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
    void this.engine.newGame?.();
  }

  applyStrength(options: Parameters<NonNullable<ChessEngine['applyStrength']>>[0]): void {
    void this.engine.applyStrength?.(options);
  }

  destroy(): void {
    this.engine.destroy?.();
  }
}

