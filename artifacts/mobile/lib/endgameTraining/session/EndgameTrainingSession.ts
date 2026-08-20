/**
 * EndgameTrainingSession — authoritative game logic for « Défends la nulle ! ».
 * UI must not decide win/loss/30-moves/persistence; this class does.
 */
import { Chess, type Move, type Square } from 'chess.js';
import type { DefenseAnalysis, DefenseAnalyzer } from '../../defendDraw/defenseTypes.ts';
import {
  createCounterState,
  registerSafePlayerMove,
  registerConfirmedLoss,
  registerOfficialDraw,
  markAbandoned,
  enterOffScore,
  crossesLossThreshold,
  buildAttemptResult,
  findFirstMajorTurn,
  progressiveDeteriorationMessage,
  type CounterState,
} from '../domain/AttemptScoring.ts';
import {
  normalizeForDefender,
  sideToMoveFromFen,
  defenderToSide,
} from '../domain/EvaluationNormalizer.ts';
import { evaluateRegulatoryEnd } from '../domain/regulatoryEnd.ts';
import {
  ENDGAME_TRAINING_CONFIG,
  type AttemptResult,
  type EndgameTrainingPosition,
  type EvaluationPoint,
} from '../domain/types.ts';
import { chooseOpponentMove } from '../engine/PracticalPressurePolicy.ts';
import { verifyLoss, LOSS_CONFIRM_THINK_MS } from '../engine/LossVerifier.ts';

export type SessionPhase =
  | 'idle'
  | 'playing'
  | 'thinking'
  | 'verifying-loss'
  | 'won-draw'
  | 'won-30'
  | 'lost'
  | 'abandoned'
  | 'off-score'
  | 'engine-error';

export type SessionSnapshot = {
  phase: SessionPhase;
  position: EndgameTrainingPosition | null;
  fen: string;
  startFen: string | null;
  defender: 'w' | 'b';
  movesResisted: number;
  targetMoves: number;
  /** Player-POV eval for gauge. */
  evalCp: number;
  mateIn: number | null;
  lastMove: { from: string; to: string } | null;
  lastFeedback: string | null;
  scoreLocked: boolean;
  offScore: boolean;
  result: AttemptResult | null;
  timeline: EvaluationPoint[];
  moveSans: string[];
  canOfferActions: boolean;
};

export type SessionOptions = {
  analyzer?: DefenseAnalyzer | null;
};

export class EndgameTrainingSession {
  private game = new Chess();
  private position: EndgameTrainingPosition | null = null;
  private startFen: string | null = null;
  private phase: SessionPhase = 'idle';
  private counter: CounterState = createCounterState();
  private analyzer: DefenseAnalyzer | null;
  private timeline: EvaluationPoint[] = [];
  private moveSans: string[] = [];
  private lastMove: { from: string; to: string } | null = null;
  private lastFeedback: string | null = null;
  private evalCp = 0;
  private mateIn: number | null = null;
  private result: AttemptResult | null = null;
  private officialDrawReason: AttemptResult['officialDrawReason'];

  constructor(options: SessionOptions = {}) {
    this.analyzer = options.analyzer ?? null;
  }

  setAnalyzer(analyzer: DefenseAnalyzer | null): void {
    this.analyzer = analyzer;
  }

  async start(position: EndgameTrainingPosition): Promise<SessionSnapshot> {
    this.position = position;
    this.startFen = position.fen;
    this.game = new Chess(position.fen);
    this.phase = 'playing';
    this.counter = createCounterState();
    this.timeline = [
      {
        afterPlayerMove: 0,
        playerMoveNumber: 0,
        fen: position.fen,
        scoreCp: position.quality.initialEvaluation,
        mateIn: null,
      },
    ];
    this.moveSans = [];
    this.lastMove = null;
    this.lastFeedback = null;
    this.evalCp = position.quality.initialEvaluation;
    this.mateIn = null;
    this.result = null;
    this.officialDrawReason = undefined;
    return this.snapshot();
  }

  /** Retenter — same position, fresh attempt. */
  async retry(): Promise<SessionSnapshot> {
    if (!this.position) return this.snapshot();
    return this.start(this.position);
  }

  abandon(): SessionSnapshot {
    if (this.counter.scoreLocked) return this.snapshot();
    this.counter = markAbandoned(this.counter);
    this.phase = 'abandoned';
    this.result = this.buildResult();
    return this.snapshot();
  }

  continueOffScore(): SessionSnapshot {
    if (!this.counter.scoreLocked) return this.snapshot();
    this.counter = enterOffScore(this.counter);
    this.phase = 'off-score';
    this.lastFeedback = 'Suite hors score';
    return this.snapshot();
  }

  getLegalDestinations(from: string): string[] {
    if (this.phase !== 'playing' && this.phase !== 'off-score') return [];
    return this.game
      .moves({ square: from as Square, verbose: true })
      .map((m) => m.to);
  }

  async attemptMove(
    from: string,
    to: string,
    promotion: string = 'q',
  ): Promise<SessionSnapshot> {
    if (
      (this.phase !== 'playing' && this.phase !== 'off-score') ||
      !this.position
    ) {
      return this.snapshot();
    }
    const defender = defenderToSide(this.position.defender);
    if (this.game.turn() !== defender) return this.snapshot();

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
    this.moveSans.push(played.san);

    // Regulatory end first
    const reg = evaluateRegulatoryEnd(this.game);
    if (reg) {
      return this.applyRegulatory(reg, played.san);
    }

    if (!this.analyzer) {
      this.lastFeedback = 'Stockfish indisponible.';
      this.phase = 'engine-error';
      return this.snapshot();
    }

    // Evaluate after player move
    this.phase = this.counter.offScore ? 'thinking' : 'verifying-loss';
    const thinkMs = ENDGAME_TRAINING_CONFIG.opponentThinkMs;
    let analysis: DefenseAnalysis;
    try {
      analysis = await this.analyzer.analyze(this.game.fen(), thinkMs);
    } catch {
      this.lastFeedback = 'Erreur moteur.';
      this.phase = 'engine-error';
      return this.snapshot();
    }

    const norm = normalizeForDefender(
      {
        scoreCp: analysis.scoreCp,
        mateIn: analysis.mateIn,
        sideToMove: sideToMoveFromFen(this.game.fen()),
      },
      this.position.defender,
    );
    this.evalCp = norm.scoreCp;
    this.mateIn = norm.mateIn;

    // Score / loss logic only when not already locked off-score from a prior win
    if (!this.counter.scoreLocked || this.counter.outcome === 'in-progress') {
      if (crossesLossThreshold(norm.scoreCp) || (norm.mateIn != null && norm.mateIn < 0)) {
        this.phase = 'verifying-loss';
        let confirmation: DefenseAnalysis | null = null;
        try {
          confirmation = await this.analyzer.analyze(
            this.game.fen(),
            LOSS_CONFIRM_THINK_MS,
          );
        } catch {
          confirmation = null;
        }
        const confNorm = confirmation
          ? normalizeForDefender(
              {
                scoreCp: confirmation.scoreCp,
                mateIn: confirmation.mateIn,
                sideToMove: sideToMoveFromFen(this.game.fen()),
              },
              this.position.defender,
            )
          : null;

        const verdict = verifyLoss(
          { scoreCp: norm.scoreCp, mateIn: norm.mateIn },
          confNorm
            ? { scoreCp: confNorm.scoreCp, mateIn: confNorm.mateIn }
            : null,
        );

        if (verdict.lost) {
          this.evalCp = verdict.confirmedScoreCp;
          this.pushTimeline(played.san);
          this.counter = registerConfirmedLoss(this.counter);
          this.phase = 'lost';
          this.result = this.buildResult();
          this.lastFeedback = `Tu as résisté ${this.counter.movesResisted} coups`;
          return this.snapshot();
        }
        // Recovered — use confirmation eval
        if (confNorm) {
          this.evalCp = confNorm.scoreCp;
          this.mateIn = confNorm.mateIn;
        }
      }

      // Safe move — count it first, then record timeline with updated count
      this.counter = registerSafePlayerMove(this.counter);
      this.timeline.push({
        afterPlayerMove: this.counter.movesResisted,
        playerMoveNumber: this.counter.movesResisted,
        fen: this.game.fen(),
        scoreCp: this.evalCp,
        mateIn: this.mateIn,
        san: played.san,
      });
      if (this.counter.outcome === 'win-30-moves') {
        this.phase = 'won-30';
        this.result = this.buildResult();
        this.lastFeedback = 'Finale défendue !\nTu as résisté 30 coups.';
        return this.snapshot();
      }
    } else {
      // Off-score play — still update timeline/eval but not score
      this.timeline.push({
        afterPlayerMove: this.counter.movesResisted,
        playerMoveNumber: this.counter.movesResisted,
        fen: this.game.fen(),
        scoreCp: this.evalCp,
        mateIn: this.mateIn,
        san: played.san,
      });
    }

    // Opponent reply
    await this.playOpponent();
    return this.snapshot();
  }

  async answerSan(san: string): Promise<SessionSnapshot> {
    if (!this.position) return this.snapshot();
    const clone = new Chess(this.game.fen());
    let move: Move | null = null;
    try {
      move = clone.move(san) as Move;
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

  private pushTimeline(san: string): void {
    const n = this.counter.scoreLocked
      ? this.counter.movesResisted
      : this.counter.movesResisted + (this.phase === 'lost' ? 0 : 0);
    // After safe move registration, movesResisted is already updated;
    // for loss path, movesResisted was NOT incremented — use current+0 display as next attempt number.
    const playerMoveNumber =
      this.counter.outcome === 'loss'
        ? this.counter.movesResisted + 1
        : this.counter.movesResisted;
    this.timeline.push({
      afterPlayerMove: playerMoveNumber,
      playerMoveNumber,
      fen: this.game.fen(),
      scoreCp: this.evalCp,
      mateIn: this.mateIn,
      san,
    });
  }

  private applyRegulatory(
    reg: NonNullable<ReturnType<typeof evaluateRegulatoryEnd>>,
    san: string,
  ): SessionSnapshot {
    if (reg.kind === 'checkmate') {
      const defender = defenderToSide(this.position!.defender);
      if (reg.winner === defender) {
        // Player somehow checkmated — treat as official success (draw objective allows win)
        this.pushTimelinePoint(san);
        if (!this.counter.scoreLocked) {
          this.counter = registerOfficialDraw(this.counter);
        }
        this.phase = 'won-draw';
        this.officialDrawReason = undefined;
        this.result = this.buildResult();
        this.lastFeedback = 'Mat ! Finale défendue.';
      } else {
        this.pushTimelinePoint(san);
        this.counter = registerConfirmedLoss(this.counter);
        this.phase = 'lost';
        this.result = this.buildResult();
        this.lastFeedback = `Tu as résisté ${this.counter.movesResisted} coups`;
      }
      return this.snapshot();
    }

    // Official draw
    this.pushTimelinePoint(san);
    if (!this.counter.scoreLocked || this.counter.outcome === 'in-progress') {
      this.counter = registerSafePlayerMove(this.counter);
      this.counter = registerOfficialDraw(this.counter);
    }
    this.officialDrawReason = reg.reason;
    this.phase = 'won-draw';
    this.result = this.buildResult();
    this.lastFeedback = 'Nulle ! Finale défendue.';
    return this.snapshot();
  }

  private pushTimelinePoint(san: string): void {
    const playerMoveNumber =
      this.counter.outcome === 'loss'
        ? this.counter.movesResisted + 1
        : Math.max(1, this.counter.movesResisted);
    this.timeline.push({
      afterPlayerMove: playerMoveNumber,
      playerMoveNumber,
      fen: this.game.fen(),
      scoreCp: this.evalCp,
      mateIn: this.mateIn,
      san,
    });
  }

  private async playOpponent(): Promise<void> {
    if (!this.analyzer || !this.position) {
      this.phase = this.counter.offScore
        ? 'off-score'
        : this.counter.scoreLocked
          ? this.phase
          : 'playing';
      return;
    }
    if (this.game.isGameOver()) {
      const reg = evaluateRegulatoryEnd(this.game);
      if (reg) this.applyRegulatory(reg, '');
      return;
    }

    this.phase = 'thinking';
    let analysis: DefenseAnalysis;
    try {
      if (this.analyzer.analyzePosition) {
        analysis = await this.analyzer.analyzePosition({
          fen: this.game.fen(),
          movetimeMs: ENDGAME_TRAINING_CONFIG.opponentThinkMs,
          multiPv: ENDGAME_TRAINING_CONFIG.multiPv,
        });
      } else {
        analysis = await this.analyzer.analyze(
          this.game.fen(),
          ENDGAME_TRAINING_CONFIG.opponentThinkMs,
        );
      }
    } catch {
      this.lastFeedback = 'Erreur moteur.';
      this.phase = 'engine-error';
      return;
    }

    const pick = chooseOpponentMove(this.game.fen(), analysis);
    if (!pick) {
      this.phase = this.counter.offScore ? 'off-score' : 'playing';
      return;
    }

    try {
      const played = this.game.move({
        from: pick.from,
        to: pick.to,
        promotion: pick.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      }) as Move;
      this.lastMove = { from: played.from, to: played.to };
      this.moveSans.push(played.san);
    } catch {
      this.phase = this.counter.offScore ? 'off-score' : 'playing';
      return;
    }

    const reg = evaluateRegulatoryEnd(this.game);
    if (reg) {
      this.applyRegulatory(reg, '');
      return;
    }

    // Update eval for gauge after opponent move
    try {
      const after = await this.analyzer.analyze(
        this.game.fen(),
        ENDGAME_TRAINING_CONFIG.opponentThinkMs,
      );
      const norm = normalizeForDefender(
        {
          scoreCp: after.scoreCp,
          mateIn: after.mateIn,
          sideToMove: sideToMoveFromFen(this.game.fen()),
        },
        this.position.defender,
      );
      this.evalCp = norm.scoreCp;
      this.mateIn = norm.mateIn;
    } catch {
      /* keep previous */
    }

    if (this.counter.offScore) this.phase = 'off-score';
    else if (this.counter.outcome === 'win-30-moves') this.phase = 'won-30';
    else if (this.counter.outcome === 'win-official-draw') this.phase = 'won-draw';
    else if (this.counter.outcome === 'loss') this.phase = 'lost';
    else {
      this.phase = 'playing';
      this.lastFeedback = null;
    }
  }

  private buildResult(): AttemptResult {
    const result = buildAttemptResult({
      state: this.counter,
      timeline: this.timeline,
      moveSans: this.moveSans,
      startFen: this.startFen ?? this.game.fen(),
      endFen: this.game.fen(),
      positionId: this.position?.id ?? '',
      officialDrawReason: this.officialDrawReason,
    });
    if (result.outcome === 'loss' && !result.firstMajorTurn) {
      // attach progressive message via firstMajorTurn null — UI uses helper
      result.firstMajorTurn = null;
    }
    return result;
  }

  getFirstMajorTurnMessage(): string {
    if (!this.result || this.result.outcome !== 'loss') return '';
    if (this.result.firstMajorTurn) {
      const t = this.result.firstMajorTurn;
      const before = (t.scoreBefore / 100).toFixed(2);
      const after = (t.scoreAfter / 100).toFixed(2);
      return `${t.message}\nL’évaluation est passée de ${before} à ${after}.`;
    }
    return progressiveDeteriorationMessage();
  }

  snapshot(): SessionSnapshot {
    return {
      phase: this.phase,
      position: this.position,
      fen: this.game.fen(),
      startFen: this.startFen,
      defender: this.position ? defenderToSide(this.position.defender) : 'w',
      movesResisted: this.counter.movesResisted,
      targetMoves: ENDGAME_TRAINING_CONFIG.targetPlayerMoves,
      evalCp: this.evalCp,
      mateIn: this.mateIn,
      lastMove: this.lastMove,
      lastFeedback: this.lastFeedback,
      scoreLocked: this.counter.scoreLocked,
      offScore: this.counter.offScore,
      result: this.result,
      timeline: [...this.timeline],
      moveSans: [...this.moveSans],
      canOfferActions:
        this.phase === 'lost' ||
        this.phase === 'won-30' ||
        this.phase === 'won-draw',
    };
  }

  getChess(): Chess {
    return this.game;
  }
}

// re-export helpers used by UI
export { findFirstMajorTurn, progressiveDeteriorationMessage };
