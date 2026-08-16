/**
 * Défends la nulle — hold a draw for TARGET player moves.
 */
import { Chess, type Move, type Square } from 'chess.js';
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import {
  pickDefendDrawPosition,
  type DefendDrawPosition,
} from './positions.ts';
import { probeWdlForPlayer, type WdlProbeOptions } from './WdlProbe.ts';
import { DEFEND_DRAW_TARGET_MOVES, type WdlProbeResult } from './wdl.ts';

export type DefendDrawPhase =
  | 'ready'
  | 'playing'
  | 'thinking'
  | 'won'
  | 'lost'
  | 'drawn-early';

export type DefendDrawSnapshot = {
  phase: DefendDrawPhase;
  position: DefendDrawPosition | null;
  fen: string;
  playerColor: 'w' | 'b';
  playerMovesMade: number;
  targetMoves: number;
  lastFeedback: string | null;
  lastProbe: WdlProbeResult | null;
  lastMove: { from: string; to: string } | null;
  difficulty: AnyChessDifficultyId;
};

export type DefendDrawSessionOptions = {
  probeOptions?: WdlProbeOptions;
  targetMoves?: number;
};

export class DefendDrawSession {
  private game = new Chess();
  private position: DefendDrawPosition | null = null;
  private phase: DefendDrawPhase = 'ready';
  private playerMovesMade = 0;
  private lastFeedback: string | null = null;
  private lastProbe: WdlProbeResult | null = null;
  private lastMove: { from: string; to: string } | null = null;
  private difficulty: AnyChessDifficultyId = 'debutant';
  private readonly probeOptions: WdlProbeOptions;
  private readonly targetMoves: number;

  constructor(options: DefendDrawSessionOptions = {}) {
    this.probeOptions = options.probeOptions ?? { disableTablebase: false };
    this.targetMoves = options.targetMoves ?? DEFEND_DRAW_TARGET_MOVES;
  }

  async start(
    difficulty: AnyChessDifficultyId,
    recentIds: string[] = [],
    rng: () => number = Math.random,
  ): Promise<DefendDrawSnapshot> {
    this.difficulty = difficulty;
    this.position = pickDefendDrawPosition(difficulty, recentIds, rng);
    this.game = new Chess(this.position.fen);
    // Ensure it's the player's turn; if not, skip an opponent "free" ply is not done —
    // curated FENs are already on the player's turn.
    this.phase = 'playing';
    this.playerMovesMade = 0;
    this.lastFeedback = null;
    this.lastMove = null;
    this.lastProbe = await probeWdlForPlayer(
      this.game.fen(),
      this.position.playerColor,
      this.probeOptions,
    );
    if (this.lastProbe.verdict === 'loss') {
      this.phase = 'lost';
      this.lastFeedback = 'Position déjà perdue.';
    }
    return this.snapshot();
  }

  getLegalDestinations(from: string): string[] {
    if (this.phase !== 'playing') return [];
    return this.game
      .moves({ square: from as Square, verbose: true })
      .map((m) => m.to);
  }

  /**
   * Apply a player board move. Returns snapshot after player move (+ optional opponent).
   */
  async attemptMove(
    from: string,
    to: string,
    promotion: string = 'q',
  ): Promise<DefendDrawSnapshot> {
    if (this.phase !== 'playing' || !this.position) return this.snapshot();
    if (this.game.turn() !== this.position.playerColor) return this.snapshot();

    let played: Move | null = null;
    try {
      played = this.game.move({
        from,
        to,
        promotion: promotion as 'q' | 'r' | 'b' | 'n',
      }) as Move;
    } catch {
      this.lastFeedback = 'Coup illégal.';
      return this.snapshot();
    }
    if (!played) {
      this.lastFeedback = 'Coup illégal.';
      return this.snapshot();
    }

    this.lastMove = { from: played.from, to: played.to };
    this.playerMovesMade += 1;

    const afterPlayer = await probeWdlForPlayer(
      this.game.fen(),
      this.position.playerColor,
      this.probeOptions,
    );
    this.lastProbe = afterPlayer;

    if (this.game.isCheckmate()) {
      // Player delivered mate — count as challenge success.
      this.phase = 'won';
      this.lastFeedback = 'Mat !';
      return this.snapshot();
    }

    // Terminal draws that end the exercise early (not mere insufficient material).
    if (this.game.isStalemate() || this.game.isThreefoldRepetition()) {
      this.phase = 'drawn-early';
      this.lastFeedback = 'Nulle atteinte.';
      return this.snapshot();
    }

    if (afterPlayer.verdict === 'loss') {
      this.phase = 'lost';
      this.lastFeedback = 'La nulle est perdue.';
      return this.snapshot();
    }

    if (this.playerMovesMade >= this.targetMoves) {
      this.phase = 'won';
      this.lastFeedback = 'Nulle tenue !';
      return this.snapshot();
    }

    this.phase = 'thinking';
    await this.playOpponentMove();
    return this.snapshot();
  }

  async answerSan(sanOrText: string): Promise<DefendDrawSnapshot> {
    if (this.phase !== 'playing' || !this.position) return this.snapshot();
    const clone = new Chess(this.game.fen());
    let move: Move | null = null;
    try {
      move = clone.move(sanOrText) as Move;
    } catch {
      this.lastFeedback = 'Coup non reconnu.';
      return this.snapshot();
    }
    if (!move) {
      this.lastFeedback = 'Coup non reconnu.';
      return this.snapshot();
    }
    return this.attemptMove(move.from, move.to, move.promotion ?? 'q');
  }

  private async playOpponentMove(): Promise<void> {
    if (!this.position) return;
    const legal = this.game.moves({ verbose: true }) as Move[];
    if (legal.length === 0) {
      this.phase = this.game.isDraw() ? 'drawn-early' : 'lost';
      return;
    }

    // Prefer moves that put the defender under most pressure (worst for player).
    let best: Move = legal[0]!;
    let bestScore = -Infinity;
    for (const m of legal) {
      const g = new Chess(this.game.fen());
      g.move({ from: m.from, to: m.to, promotion: m.promotion });
      const probe = await probeWdlForPlayer(
        g.fen(),
        this.position.playerColor,
        this.probeOptions,
      );
      const score =
        probe.verdict === 'loss' ? 3 : probe.verdict === 'unknown' ? 1 : probe.verdict === 'draw' ? 0 : -1;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
      // Early exit if we found a forcing win against the defender.
      if (score >= 3) break;
    }

    const played = this.game.move({
      from: best.from,
      to: best.to,
      promotion: best.promotion,
    }) as Move;
    this.lastMove = { from: played.from, to: played.to };

    const afterOpp = await probeWdlForPlayer(
      this.game.fen(),
      this.position.playerColor,
      this.probeOptions,
    );
    this.lastProbe = afterOpp;

    if (this.game.isCheckmate()) {
      this.phase = 'lost';
      this.lastFeedback = 'Échec et mat.';
      return;
    }
    if (this.game.isStalemate() || this.game.isThreefoldRepetition()) {
      this.phase = 'drawn-early';
      this.lastFeedback = 'Nulle atteinte.';
      return;
    }
    if (afterOpp.verdict === 'loss') {
      this.phase = 'lost';
      this.lastFeedback = 'La nulle est perdue.';
      return;
    }

    this.phase = 'playing';
    this.lastFeedback = null;
  }

  snapshot(): DefendDrawSnapshot {
    return {
      phase: this.phase,
      position: this.position,
      fen: this.game.fen(),
      playerColor: this.position?.playerColor ?? 'w',
      playerMovesMade: this.playerMovesMade,
      targetMoves: this.targetMoves,
      lastFeedback: this.lastFeedback,
      lastProbe: this.lastProbe,
      lastMove: this.lastMove,
      difficulty: this.difficulty,
    };
  }

  getChess(): Chess {
    return this.game;
  }
}
