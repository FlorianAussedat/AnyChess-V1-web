/**
 * Défends la nulle — hold a difficult draw for TARGET player moves.
 */
import { Chess, type Move, type Square } from 'chess.js';
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import {
  pickDefendDrawPosition,
  type DefendDrawPosition,
} from './positions.ts';
import {
  pickOpponentMove,
  type StockfishPickFn,
} from './opponentMove.ts';
import { probeWdlForPlayer, type WdlProbeOptions } from './WdlProbe.ts';
import { DEFEND_DRAW_TARGET_MOVES, type WdlProbeResult } from './wdl.ts';

export type DefendDrawPhase =
  | 'ready'
  | 'playing'
  | 'thinking'
  | 'won'
  | 'lost'
  | 'drawn-early'
  /** Challenge finished but user chose Continuer on the same board. */
  | 'freeplay';

export type DefendDrawSnapshot = {
  phase: DefendDrawPhase;
  position: DefendDrawPosition | null;
  fen: string;
  playerColor: 'w' | 'b';
  playerMovesMade: number;
  targetMoves: number;
  /** True once the 30-move challenge has ended (won/lost) even in freeplay. */
  challengeComplete: boolean;
  lastFeedback: string | null;
  lastProbe: WdlProbeResult | null;
  lastMove: { from: string; to: string } | null;
  difficulty: AnyChessDifficultyId;
};

export type DefendDrawSessionOptions = {
  probeOptions?: WdlProbeOptions;
  targetMoves?: number;
  stockfishPick?: StockfishPickFn;
};

export class DefendDrawSession {
  private game = new Chess();
  private position: DefendDrawPosition | null = null;
  private startFen: string | null = null;
  private phase: DefendDrawPhase = 'ready';
  private playerMovesMade = 0;
  private challengeComplete = false;
  private lastFeedback: string | null = null;
  private lastProbe: WdlProbeResult | null = null;
  private lastMove: { from: string; to: string } | null = null;
  private difficulty: AnyChessDifficultyId = 'debutant';
  private readonly probeOptions: WdlProbeOptions;
  private readonly targetMoves: number;
  private stockfishPick?: StockfishPickFn;

  constructor(options: DefendDrawSessionOptions = {}) {
    this.probeOptions = options.probeOptions ?? { disableTablebase: false };
    this.targetMoves = options.targetMoves ?? DEFEND_DRAW_TARGET_MOVES;
    this.stockfishPick = options.stockfishPick;
  }

  setStockfishPick(fn: StockfishPickFn | undefined): void {
    this.stockfishPick = fn;
  }

  async start(
    difficulty: AnyChessDifficultyId,
    recentIds: string[] = [],
    rng: () => number = Math.random,
  ): Promise<DefendDrawSnapshot> {
    this.difficulty = difficulty;
    // Try a few candidates if tablebase rejects a non-draw start.
    let chosen: DefendDrawPosition | null = null;
    const tried = new Set<string>(recentIds);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = pickDefendDrawPosition(difficulty, [...tried], rng);
      tried.add(candidate.id);
      const probe = await probeWdlForPlayer(
        candidate.fen,
        candidate.playerColor,
        this.probeOptions,
      );
      // Accept curated draw / unknown (offline). Reject known loss/win starts.
      if (probe.verdict === 'loss' || probe.verdict === 'win') {
        continue;
      }
      chosen = candidate;
      this.lastProbe = probe;
      break;
    }
    if (!chosen) {
      chosen = pickDefendDrawPosition(difficulty, recentIds, rng);
      this.lastProbe = await probeWdlForPlayer(
        chosen.fen,
        chosen.playerColor,
        this.probeOptions,
      );
    }

    this.position = chosen;
    this.startFen = chosen.fen;
    this.game = new Chess(chosen.fen);
    this.phase = 'playing';
    this.playerMovesMade = 0;
    this.challengeComplete = false;
    this.lastFeedback = null;
    this.lastMove = null;
    return this.snapshot();
  }

  /** Reload the exact same starting position. */
  async restart(): Promise<DefendDrawSnapshot> {
    if (!this.position || !this.startFen) return this.snapshot();
    this.game = new Chess(this.startFen);
    this.phase = 'playing';
    this.playerMovesMade = 0;
    this.challengeComplete = false;
    this.lastFeedback = null;
    this.lastMove = null;
    this.lastProbe = await probeWdlForPlayer(
      this.game.fen(),
      this.position.playerColor,
      this.probeOptions,
    );
    return this.snapshot();
  }

  /** After win/loss: keep playing the same board without the challenge counter goal. */
  continueFreeplay(): DefendDrawSnapshot {
    if (!this.position) return this.snapshot();
    this.challengeComplete = true;
    if (this.game.isGameOver()) return this.snapshot();
    this.phase = 'freeplay';
    this.lastFeedback = null;
    return this.snapshot();
  }

  getLegalDestinations(from: string): string[] {
    if (this.phase !== 'playing' && this.phase !== 'freeplay') return [];
    return this.game
      .moves({ square: from as Square, verbose: true })
      .map((m) => m.to);
  }

  async attemptMove(
    from: string,
    to: string,
    promotion: string = 'q',
  ): Promise<DefendDrawSnapshot> {
    if (
      (this.phase !== 'playing' && this.phase !== 'freeplay') ||
      !this.position
    ) {
      return this.snapshot();
    }
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
    if (!this.challengeComplete && this.phase === 'playing') {
      this.playerMovesMade += 1;
    }

    const afterPlayer = await probeWdlForPlayer(
      this.game.fen(),
      this.position.playerColor,
      this.probeOptions,
    );
    this.lastProbe = afterPlayer;

    if (this.game.isCheckmate()) {
      // Defender delivered mate — challenge success (at least held / flipped).
      this.challengeComplete = true;
      this.phase = 'won';
      this.lastFeedback =
        'Nulle défendue pendant 30 coups. Finale réussie !'.replace(
          '30',
          String(this.targetMoves),
        );
      if (this.playerMovesMade < this.targetMoves) {
        this.lastFeedback = 'Mat ! Position gagnée.';
      }
      return this.snapshot();
    }

    if (this.game.isStalemate() || this.game.isThreefoldRepetition()) {
      this.challengeComplete = true;
      this.phase = 'drawn-early';
      this.lastFeedback = 'Nulle atteinte.';
      return this.snapshot();
    }

    // Tablebase / probe truth from defender POV
    if (afterPlayer.verdict === 'loss' && !this.challengeComplete) {
      this.challengeComplete = true;
      this.phase = 'lost';
      this.lastFeedback = 'Partie perdue sur jeu parfait de l’adversaire.';
      return this.snapshot();
    }

    // WIN for defender: not an error — continue (objective already exceeded).
    if (
      !this.challengeComplete &&
      this.phase === 'playing' &&
      this.playerMovesMade >= this.targetMoves &&
      afterPlayer.verdict !== 'loss'
    ) {
      this.challengeComplete = true;
      this.phase = 'won';
      this.lastFeedback = `Nulle défendue pendant ${this.targetMoves} coups. Finale réussie !`;
      return this.snapshot();
    }

    this.phase = 'thinking';
    await this.playOpponentMove();
    return this.snapshot();
  }

  async answerSan(sanOrText: string): Promise<DefendDrawSnapshot> {
    if (
      (this.phase !== 'playing' && this.phase !== 'freeplay') ||
      !this.position
    ) {
      return this.snapshot();
    }
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
    if (this.game.isGameOver()) {
      this.phase = this.game.isDraw() ? 'drawn-early' : 'lost';
      this.challengeComplete = true;
      return;
    }

    const pick = await pickOpponentMove(
      this.game.fen(),
      this.position.playerColor,
      {
        probeOptions: this.probeOptions,
        stockfishPick: this.stockfishPick,
      },
    );

    if (!pick) {
      this.phase = this.challengeComplete ? 'freeplay' : 'playing';
      return;
    }

    const played = this.game.move({
      from: pick.from,
      to: pick.to,
      promotion: pick.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    }) as Move;
    this.lastMove = { from: played.from, to: played.to };

    const afterOpp = await probeWdlForPlayer(
      this.game.fen(),
      this.position.playerColor,
      this.probeOptions,
    );
    this.lastProbe = afterOpp;

    if (this.game.isCheckmate()) {
      this.challengeComplete = true;
      this.phase = 'lost';
      this.lastFeedback = 'Partie perdue sur jeu parfait de l’adversaire.';
      return;
    }
    if (this.game.isStalemate() || this.game.isThreefoldRepetition()) {
      this.challengeComplete = true;
      this.phase = 'drawn-early';
      this.lastFeedback = 'Nulle atteinte.';
      return;
    }
    if (afterOpp.verdict === 'loss' && !this.challengeComplete) {
      this.challengeComplete = true;
      this.phase = 'lost';
      this.lastFeedback = 'Partie perdue sur jeu parfait de l’adversaire.';
      return;
    }

    this.phase = this.challengeComplete ? 'freeplay' : 'playing';
    if (this.phase === 'playing') this.lastFeedback = null;
  }

  snapshot(): DefendDrawSnapshot {
    return {
      phase: this.phase,
      position: this.position,
      fen: this.game.fen(),
      playerColor: this.position?.playerColor ?? 'w',
      playerMovesMade: this.playerMovesMade,
      targetMoves: this.targetMoves,
      challengeComplete: this.challengeComplete,
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
