/**
 * Défends la nulle session — certified draw start, then Stockfish-only play.
 * Offline WDL verification is authoring-time only; mid-game uses Stockfish.
 */
import { Chess, type Move, type Square } from 'chess.js';
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import {
  endgamePositionRepository,
  type CertifiedEndgamePosition,
} from './EndgamePositionRepository.ts';
import {
  isClearlyLostPosition,
  type ClearlyLostVerdict,
} from './isClearlyLostPosition.ts';
import type {
  DefenseAnalysis,
  DefenseAnalyzer,
} from './StockfishAnalysisService.ts';
import { DEFEND_DRAW_TARGET_MOVES } from './wdl.ts';

export type DefendDrawPhase =
  | 'ready'
  | 'playing'
  | 'thinking'
  | 'won'
  | 'lost'
  | 'drawn-early'
  | 'freeplay';

export type DefendDrawSnapshot = {
  phase: DefendDrawPhase;
  position: CertifiedEndgamePosition | null;
  fen: string;
  playerColor: 'w' | 'b';
  playerMovesMade: number;
  targetMoves: number;
  challengeComplete: boolean;
  lastFeedback: string | null;
  lastAnalysis: DefenseAnalysis | null;
  lastLostVerdict: ClearlyLostVerdict | null;
  lastMove: { from: string; to: string } | null;
  difficulty: AnyChessDifficultyId;
};

export type DefendDrawSessionOptions = {
  targetMoves?: number;
  /** Required for live play — StockfishAnalysisService or a test mock. */
  analyzer?: DefenseAnalyzer;
  repository?: typeof endgamePositionRepository;
};

const LOST_MESSAGE =
  'La position est maintenant considérée comme perdante par Stockfish.';
const MATE_MESSAGE = 'Mat forcé détecté.';
const FORCED_LINE_MESSAGE =
  'La position est perdante. Stockfish a trouvé une suite forcée.';

export class DefendDrawSession {
  private game = new Chess();
  private position: CertifiedEndgamePosition | null = null;
  private startFen: string | null = null;
  private phase: DefendDrawPhase = 'ready';
  private playerMovesMade = 0;
  private challengeComplete = false;
  private lastFeedback: string | null = null;
  private lastAnalysis: DefenseAnalysis | null = null;
  private lastLostVerdict: ClearlyLostVerdict | null = null;
  private lastMove: { from: string; to: string } | null = null;
  private difficulty: AnyChessDifficultyId = 'debutant';
  private casBStreak = 0;
  private readonly targetMoves: number;
  private analyzer: DefenseAnalyzer | null;
  private readonly repository: typeof endgamePositionRepository;

  constructor(options: DefendDrawSessionOptions = {}) {
    this.targetMoves = options.targetMoves ?? DEFEND_DRAW_TARGET_MOVES;
    this.analyzer = options.analyzer ?? null;
    this.repository = options.repository ?? endgamePositionRepository;
  }

  setAnalyzer(analyzer: DefenseAnalyzer | null): void {
    this.analyzer = analyzer;
  }

  async start(
    difficulty: AnyChessDifficultyId,
    recentIds: string[] = [],
    rng: () => number = Math.random,
  ): Promise<DefendDrawSnapshot> {
    this.difficulty = difficulty;
    const chosen = this.repository.pick(difficulty, recentIds, rng);
    // Pool entries are pre-certified draws — no mid-session WDL probes.
    this.position = chosen;
    this.startFen = chosen.fen;
    this.game = new Chess(chosen.fen);
    this.phase = 'playing';
    this.playerMovesMade = 0;
    this.challengeComplete = false;
    this.lastFeedback = null;
    this.lastMove = null;
    this.lastAnalysis = null;
    this.lastLostVerdict = null;
    this.casBStreak = 0;
    return this.snapshot();
  }

  async restart(): Promise<DefendDrawSnapshot> {
    if (!this.position || !this.startFen) return this.snapshot();
    this.game = new Chess(this.startFen);
    this.phase = 'playing';
    this.playerMovesMade = 0;
    this.challengeComplete = false;
    this.lastFeedback = null;
    this.lastMove = null;
    this.lastAnalysis = null;
    this.lastLostVerdict = null;
    this.casBStreak = 0;
    return this.snapshot();
  }

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

    // Terminal board states (no engine needed)
    if (this.game.isCheckmate()) {
      // Defender delivered mate → success / flipped
      this.challengeComplete = true;
      this.phase = 'won';
      this.lastFeedback =
        this.playerMovesMade >= this.targetMoves
          ? `Nulle défendue pendant ${this.targetMoves} coups. Finale réussie !`
          : 'Mat ! Position gagnée.';
      return this.snapshot();
    }
    if (this.game.isStalemate() || this.game.isThreefoldRepetition()) {
      this.challengeComplete = true;
      this.phase = 'drawn-early';
      this.lastFeedback = 'Nulle atteinte.';
      return this.snapshot();
    }

    if (!this.analyzer) {
      this.lastFeedback = 'Stockfish indisponible.';
      this.phase = this.challengeComplete ? 'freeplay' : 'playing';
      return this.snapshot();
    }

    this.phase = 'thinking';
    const analysis = await this.analyzer.analyze(this.game.fen());
    this.lastAnalysis = analysis;

    const lost = isClearlyLostPosition(
      analysis,
      this.game.fen(),
      this.position.playerColor,
      this.casBStreak,
    );
    this.casBStreak = lost.nextStreak;
    this.lastLostVerdict = lost.verdict;

    if (lost.clearlyLost && !this.challengeComplete) {
      this.challengeComplete = true;
      this.phase = 'lost';
      if (lost.verdict.reason === 'mate') {
        this.lastFeedback =
          analysis.mateIn != null ? MATE_MESSAGE : FORCED_LINE_MESSAGE;
      } else {
        this.lastFeedback = LOST_MESSAGE;
      }
      return this.snapshot();
    }

    if (
      !this.challengeComplete &&
      this.phase === 'thinking' &&
      this.playerMovesMade >= this.targetMoves
    ) {
      this.challengeComplete = true;
      this.phase = 'won';
      this.lastFeedback = `Nulle défendue pendant ${this.targetMoves} coups. Finale réussie !`;
      return this.snapshot();
    }

    // Opponent reply — Stockfish best move from the post-player analysis (STM = opponent).
    await this.applyOpponentBestMove(analysis);
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

  private async applyOpponentBestMove(analysis: DefenseAnalysis): Promise<void> {
    if (!this.position || !this.analyzer) return;

    let pick = analysis.bestMove;
    // Ensure we search from the opponent's turn.
    if (this.game.turn() === this.position.playerColor || !pick) {
      const refreshed = await this.analyzer.analyze(this.game.fen());
      this.lastAnalysis = refreshed;
      pick = refreshed.bestMove;
    }

    if (!pick || this.game.turn() === this.position.playerColor) {
      this.phase = this.challengeComplete ? 'freeplay' : 'playing';
      return;
    }

    try {
      const played = this.game.move({
        from: pick.from,
        to: pick.to,
        promotion: pick.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      }) as Move;
      this.lastMove = { from: played.from, to: played.to };
    } catch {
      this.phase = this.challengeComplete ? 'freeplay' : 'playing';
      return;
    }

    if (this.game.isCheckmate()) {
      this.challengeComplete = true;
      this.phase = 'lost';
      this.lastFeedback = MATE_MESSAGE;
      return;
    }
    if (this.game.isStalemate() || this.game.isThreefoldRepetition()) {
      this.challengeComplete = true;
      this.phase = 'drawn-early';
      this.lastFeedback = 'Nulle atteinte.';
      return;
    }

    const afterOpp = await this.analyzer.analyze(this.game.fen());
    this.lastAnalysis = afterOpp;
    const lost = isClearlyLostPosition(
      afterOpp,
      this.game.fen(),
      this.position.playerColor,
      this.casBStreak,
    );
    this.casBStreak = lost.nextStreak;
    this.lastLostVerdict = lost.verdict;

    if (lost.clearlyLost && !this.challengeComplete) {
      this.challengeComplete = true;
      this.phase = 'lost';
      this.lastFeedback =
        lost.verdict.reason === 'mate' ? FORCED_LINE_MESSAGE : LOST_MESSAGE;
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
      lastAnalysis: this.lastAnalysis,
      lastLostVerdict: this.lastLostVerdict,
      lastMove: this.lastMove,
      difficulty: this.difficulty,
    };
  }

  getChess(): Chess {
    return this.game;
  }
}
