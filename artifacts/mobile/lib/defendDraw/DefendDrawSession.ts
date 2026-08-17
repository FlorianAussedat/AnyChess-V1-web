/**
 * Défends la nulle session — certified draw start, then Stockfish-only play.
 * Offline WDL verification is authoring-time only; mid-game uses Stockfish.
 * Regulatory draws/mates use the live chess.js game as single source of truth.
 */
import { Chess, type Move, type Square } from 'chess.js';
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import {
  DefendDrawPoolEmptyError,
  endgamePositionRepository,
  type CertifiedEndgamePosition,
} from './EndgamePositionRepository.ts';
import type { EndgameFamily } from './taxonomy.ts';
import {
  isClearlyLostPosition,
  type ClearlyLostVerdict,
} from './isClearlyLostPosition.ts';
import type {
  DefenseAnalysis,
  DefenseAnalyzer,
} from './defenseTypes.ts';
import { defendDrawMoveTimeMs } from './engineConfig.ts';
import {
  evaluateRegulatoryEnd,
  regulatorySuccessMessage,
} from './gameEnd.ts';
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
  /** True when rules ended the game (mate/draw) — Continuer should be hidden. */
  boardGameOver: boolean;
  lastFeedback: string | null;
  lastAnalysis: DefenseAnalysis | null;
  lastLostVerdict: ClearlyLostVerdict | null;
  lastMove: { from: string; to: string } | null;
  difficulty: AnyChessDifficultyId;
  poolError: string | null;
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
  private poolError: string | null = null;
  private recentFamilies: EndgameFamily[] = [];
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
    this.poolError = null;
    try {
      const chosen = this.repository.pick(
        difficulty,
        recentIds,
        rng,
        this.recentFamilies,
      );
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
      this.recentFamilies = [chosen.family, ...this.recentFamilies].slice(0, 8);
    } catch (err) {
      this.position = null;
      this.startFen = null;
      this.phase = 'ready';
      this.poolError =
        err instanceof DefendDrawPoolEmptyError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      this.lastFeedback = this.poolError;
    }
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
    this.poolError = null;
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

  /**
   * Apply regulatory end if the live game is finished.
   * Returns true when the challenge stopped (no Stockfish call).
   */
  private applyRegulatoryEnd(): boolean {
    const end = evaluateRegulatoryEnd(this.game);
    if (!end) return false;

    this.challengeComplete = true;

    if (end.kind === 'checkmate') {
      const defenderWon = end.winner === this.position!.playerColor;
      if (defenderWon) {
        this.phase = 'won';
        this.lastFeedback = 'Mat ! Position gagnée.';
      } else {
        this.phase = 'lost';
        this.lastFeedback = MATE_MESSAGE;
      }
      return true;
    }

    // Any regulatory draw is a success for "defend the draw".
    this.phase = 'drawn-early';
    this.lastFeedback = regulatorySuccessMessage(end.kind);
    return true;
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

    // Rules first — never call Stockfish after a finished game.
    if (this.applyRegulatoryEnd()) {
      return this.snapshot();
    }

    if (!this.analyzer) {
      this.lastFeedback = 'Stockfish indisponible.';
      this.phase = this.challengeComplete ? 'freeplay' : 'playing';
      return this.snapshot();
    }

    this.phase = 'thinking';
    const thinkMs = defendDrawMoveTimeMs(this.difficulty);
    const analysis = await this.analyzer.analyze(this.game.fen(), thinkMs);
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
    if (this.game.turn() === this.position.playerColor || !pick) {
      const refreshed = await this.analyzer.analyze(
        this.game.fen(),
        defendDrawMoveTimeMs(this.difficulty),
      );
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

    if (this.applyRegulatoryEnd()) {
      return;
    }

    const afterOpp = await this.analyzer.analyze(
      this.game.fen(),
      defendDrawMoveTimeMs(this.difficulty),
    );
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
      boardGameOver: this.game.isGameOver(),
      lastFeedback: this.lastFeedback,
      lastAnalysis: this.lastAnalysis,
      lastLostVerdict: this.lastLostVerdict,
      lastMove: this.lastMove,
      difficulty: this.difficulty,
      poolError: this.poolError,
    };
  }

  getChess(): Chess {
    return this.game;
  }
}
