/**
 * Endgame training session — play full endgames against Stockfish.
 *
 * Certified draw start (from the pool), then Stockfish-only play.
 * Supports WIN and DRAW objectives. No arbitrary move cap — games play
 * until an official result (checkmate, stalemate, repetition, 50-move,
 * insufficient material) or until Stockfish declares clearly lost.
 *
 * Regulatory draws/mates use the live chess.js game as single source of truth.
 * Offline WDL verification is authoring-time only; mid-game uses Stockfish.
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
  isObjectiveSuccess,
  objectiveFeedbackMessage,
} from './gameEnd.ts';
import type { EndgameObjective } from './positions.ts';
import {
  canOfferDraw,
  evaluateDrawOffer,
  type DrawOfferResult,
} from './drawOffer.ts';
import { findFirstError, type FirstErrorResult } from './firstError.ts';
import {
  chooseOpponentMove,
  resolveOpponentPolicy,
} from './practicalPressure.ts';
import { PRACTICAL_PRESSURE_CONFIG } from './qualityConfig.ts';
import type { EndgameOpponentPolicy, EndgameTrainingStyle } from './qualityConfig.ts';
import { materialSignature } from './materialSignature.ts';

export type EndgamePhase =
  | 'ready'
  | 'playing'
  | 'thinking'
  | 'success'
  | 'failure'
  | 'drawn-early';

/** @deprecated Use EndgamePhase */
export type DefendDrawPhase = EndgamePhase | 'won' | 'lost' | 'freeplay';

export type EndgameSnapshot = {
  phase: EndgamePhase;
  position: CertifiedEndgamePosition | null;
  fen: string;
  startFen: string | null;
  playerColor: 'w' | 'b';
  objective: EndgameObjective;
  playerMovesMade: number;
  /** True when rules ended the game (mate/draw) — board is terminal. */
  boardGameOver: boolean;
  lastFeedback: string | null;
  lastAnalysis: DefenseAnalysis | null;
  lastLostVerdict: ClearlyLostVerdict | null;
  lastMove: { from: string; to: string } | null;
  difficulty: AnyChessDifficultyId;
  poolError: string | null;
  canOfferDraw: boolean;
  moveHistory: string[];
};

/** @deprecated Use EndgameSnapshot */
export type DefendDrawSnapshot = EndgameSnapshot;

export type EndgameSessionOptions = {
  analyzer?: DefenseAnalyzer;
  repository?: typeof endgamePositionRepository;
};

/** @deprecated Use EndgameSessionOptions */
export type DefendDrawSessionOptions = EndgameSessionOptions;

const LOST_MESSAGE =
  'La position est maintenant considérée comme perdante par Stockfish.';
const MATE_MESSAGE = 'Mat forcé détecté.';
const FORCED_LINE_MESSAGE =
  'La position est perdante. Stockfish a trouvé une suite forcée.';

export class DefendDrawSession {
  private game = new Chess();
  private position: CertifiedEndgamePosition | null = null;
  private startFen: string | null = null;
  private phase: EndgamePhase = 'ready';
  private playerMovesMade = 0;
  private lastFeedback: string | null = null;
  private lastAnalysis: DefenseAnalysis | null = null;
  private lastLostVerdict: ClearlyLostVerdict | null = null;
  private lastMove: { from: string; to: string } | null = null;
  private difficulty: AnyChessDifficultyId = 'debutant';
  private objective: EndgameObjective = 'DRAW';
  private casBStreak = 0;
  private poolError: string | null = null;
  private recentFamilies: EndgameFamily[] = [];
  private recentMaterialSignatures: string[] = [];
  private recentStyles: EndgameTrainingStyle[] = [];
  private lastDrawOfferMove: number | null = null;
  private moveHistory: string[] = [];
  private analyzer: DefenseAnalyzer | null;
  private readonly repository: typeof endgamePositionRepository;
  private opponentPolicy: EndgameOpponentPolicy = 'practical-pressure';

  constructor(options: EndgameSessionOptions = {}) {
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
  ): Promise<EndgameSnapshot> {
    this.difficulty = difficulty;
    this.poolError = null;
    try {
      const chosen = this.repository.pick(
        difficulty,
        recentIds,
        rng,
        this.recentFamilies,
        this.recentMaterialSignatures,
        this.recentStyles,
      );
      this.position = chosen;
      this.startFen = chosen.fen;
      this.objective = chosen.objective ?? 'DRAW';
      this.opponentPolicy = resolveOpponentPolicy(this.objective);
      this.game = new Chess(chosen.fen);
      this.phase = 'playing';
      this.playerMovesMade = 0;
      this.lastFeedback = null;
      this.lastMove = null;
      this.lastAnalysis = null;
      this.lastLostVerdict = null;
      this.casBStreak = 0;
      this.lastDrawOfferMove = null;
      this.moveHistory = [];
      this.recentFamilies = [chosen.family, ...this.recentFamilies].slice(0, 8);
      const mat = chosen.materialSignature ?? materialSignature(chosen.fen);
      this.recentMaterialSignatures = [mat, ...this.recentMaterialSignatures].slice(0, 8);
      this.recentStyles = [
        chosen.trainingStyle ?? 'practical',
        ...this.recentStyles,
      ].slice(0, 8);
    } catch (err) {
      this.position = null;
      this.startFen = null;
      this.phase = 'ready';
      this.objective = 'DRAW';
      this.moveHistory = [];
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

  async restart(): Promise<EndgameSnapshot> {
    if (!this.position || !this.startFen) return this.snapshot();
    this.game = new Chess(this.startFen);
    this.phase = 'playing';
    this.playerMovesMade = 0;
    this.lastFeedback = null;
    this.lastMove = null;
    this.lastAnalysis = null;
    this.lastLostVerdict = null;
    this.casBStreak = 0;
    this.poolError = null;
    this.lastDrawOfferMove = null;
    this.moveHistory = [];
    return this.snapshot();
  }

  getLegalDestinations(from: string): string[] {
    if (this.phase !== 'playing') return [];
    return this.game
      .moves({ square: from as Square, verbose: true })
      .map((m) => m.to);
  }

  /**
   * Apply regulatory end if the live game is finished.
   * Returns true when the game stopped (no Stockfish call needed).
   */
  private applyRegulatoryEnd(): boolean {
    const end = evaluateRegulatoryEnd(this.game);
    if (!end) return false;

    const success = isObjectiveSuccess(end, this.position!.playerColor, this.objective);
    this.phase = success ? 'success' : 'failure';
    this.lastFeedback = objectiveFeedbackMessage(end, this.position!.playerColor, this.objective);
    return true;
  }

  async attemptMove(
    from: string,
    to: string,
    promotion: string = 'q',
  ): Promise<EndgameSnapshot> {
    if (this.phase !== 'playing' || !this.position) {
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
    this.playerMovesMade += 1;
    this.moveHistory.push(played.san);

    // Rules first — never call Stockfish after a finished game.
    if (this.applyRegulatoryEnd()) {
      return this.snapshot();
    }

    if (!this.analyzer) {
      this.lastFeedback = 'Stockfish indisponible.';
      this.phase = 'playing';
      return this.snapshot();
    }

    this.phase = 'thinking';
    const thinkMs = defendDrawMoveTimeMs(this.difficulty);
    const analysis = await this.analyzeForOpponent(this.game.fen(), thinkMs);
    this.lastAnalysis = analysis;

    const lost = isClearlyLostPosition(
      analysis,
      this.game.fen(),
      this.position.playerColor,
      this.casBStreak,
    );
    this.casBStreak = lost.nextStreak;
    this.lastLostVerdict = lost.verdict;

    if (lost.clearlyLost) {
      this.phase = 'failure';
      if (lost.verdict.reason === 'mate') {
        this.lastFeedback =
          analysis.mateIn != null ? MATE_MESSAGE : FORCED_LINE_MESSAGE;
      } else {
        this.lastFeedback = LOST_MESSAGE;
      }
      return this.snapshot();
    }

    await this.applyOpponentBestMove(analysis);
    return this.snapshot();
  }

  async answerSan(sanOrText: string): Promise<EndgameSnapshot> {
    if (this.phase !== 'playing' || !this.position) {
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

  async offerDraw(): Promise<EndgameSnapshot> {
    if (
      this.phase !== 'playing' ||
      !this.position ||
      !this.analyzer ||
      this.objective !== 'DRAW'
    ) {
      return this.snapshot();
    }
    if (!canOfferDraw(this.objective, this.playerMovesMade, this.lastDrawOfferMove)) {
      return this.snapshot();
    }

    this.phase = 'thinking';
    const result: DrawOfferResult = await evaluateDrawOffer(
      this.analyzer,
      this.game.fen(),
      this.position.playerColor,
    );
    this.lastDrawOfferMove = this.playerMovesMade;

    if (result.accepted) {
      this.phase = 'success';
      this.lastFeedback = 'Stockfish accepte la nulle. Objectif réussi !';
      return this.snapshot();
    }

    this.phase = 'playing';
    this.lastFeedback = result.message;
    return this.snapshot();
  }

  private async analyzeForOpponent(
    fen: string,
    thinkMs: number,
  ): Promise<DefenseAnalysis> {
    if (!this.analyzer) {
      throw new Error('Stockfish indisponible.');
    }
    if (
      this.opponentPolicy === 'practical-pressure' &&
      this.analyzer.analyzePosition
    ) {
      return this.analyzer.analyzePosition({
        fen,
        movetimeMs: thinkMs || PRACTICAL_PRESSURE_CONFIG.thinkTimeMs,
        multiPv: PRACTICAL_PRESSURE_CONFIG.multiPv,
      });
    }
    return this.analyzer.analyze(fen, thinkMs);
  }

  private async applyOpponentBestMove(analysis: DefenseAnalysis): Promise<void> {
    if (!this.position || !this.analyzer) return;

    let working = analysis;
    let pick = chooseOpponentMove(
      this.game.fen(),
      working,
      this.opponentPolicy,
    );

    if (this.game.turn() === this.position.playerColor || !pick) {
      working = await this.analyzeForOpponent(
        this.game.fen(),
        defendDrawMoveTimeMs(this.difficulty),
      );
      this.lastAnalysis = working;
      pick = chooseOpponentMove(
        this.game.fen(),
        working,
        this.opponentPolicy,
      );
    }

    if (!pick || this.game.turn() === this.position.playerColor) {
      this.phase = 'playing';
      return;
    }

    try {
      const played = this.game.move({
        from: pick.from,
        to: pick.to,
        promotion: pick.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      }) as Move;
      this.lastMove = { from: played.from, to: played.to };
      this.moveHistory.push(played.san);
    } catch {
      this.phase = 'playing';
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

    if (lost.clearlyLost) {
      this.phase = 'failure';
      this.lastFeedback =
        lost.verdict.reason === 'mate' ? FORCED_LINE_MESSAGE : LOST_MESSAGE;
      return;
    }

    this.phase = 'playing';
    this.lastFeedback = null;
  }

  async analyzeFirstError(): Promise<FirstErrorResult | null> {
    if (!this.analyzer || !this.startFen || !this.position) return null;
    if (this.phase !== 'failure') return null;
    return findFirstError(
      this.analyzer,
      this.startFen,
      this.moveHistory,
      this.position.playerColor,
      this.objective,
    );
  }

  snapshot(): EndgameSnapshot {
    return {
      phase: this.phase,
      position: this.position,
      fen: this.game.fen(),
      startFen: this.startFen,
      playerColor: this.position?.playerColor ?? 'w',
      objective: this.objective,
      playerMovesMade: this.playerMovesMade,
      boardGameOver: this.game.isGameOver(),
      lastFeedback: this.lastFeedback,
      lastAnalysis: this.lastAnalysis,
      lastLostVerdict: this.lastLostVerdict,
      lastMove: this.lastMove,
      difficulty: this.difficulty,
      poolError: this.poolError,
      canOfferDraw: canOfferDraw(
        this.objective,
        this.playerMovesMade,
        this.lastDrawOfferMove,
      ),
      moveHistory: [...this.moveHistory],
    };
  }

  getChess(): Chess {
    return this.game;
  }

  getStartFen(): string | null {
    return this.startFen;
  }
}
