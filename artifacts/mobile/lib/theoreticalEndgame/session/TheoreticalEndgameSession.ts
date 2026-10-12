/**
 * TheoreticalEndgameSession — authoritative rules for « Finales théoriques ».
 */
import { Chess, type Move, type Square } from 'chess.js';
import type { DefenseAnalyzer, DefenseAnalysis } from '../../defendDraw/defenseTypes.ts';
import { chooseStrictBestMove } from '../../engines/policies/StrictBestPolicy.ts';
import { THEORETICAL_ENDGAME_CONFIG, type TheoreticalEndgamePosition, type TheoreticalAttemptResult, type FirstTheoreticalLoss } from '../domain/types.ts';
import { gradeQuality } from '../domain/comprehensionScore.ts';
import { assessDefense, type DefenseAssessment } from '../domain/defenseFinish.ts';
import { getPositionById } from '../selection/selectors.ts';
import { evaluateRegulatoryEnd } from '../domain/regulatoryEnd.ts';
import {
  playerToSide,
  sideToMoveFromFen,
  meetsObjective,
  lostTheoreticalObjective,
  wdlToPlayerResult,
  type PlayerTheoreticalResult,
} from '../domain/theoreticalResult.ts';
import { verifyTheoreticalLoss } from '../engine/TheoreticalResultVerifier.ts';
import {
  theoreticalOfficialResultMessage,
} from '../domain/officialResultMessages.ts';
import { tMsg } from '../../i18n/tMsg.ts';

export type SessionPhase =
  | 'idle'
  | 'playing'
  | 'thinking'
  | 'verifying'
  | 'success'
  | 'theoretical-loss'
  | 'abandoned'
  | 'interrupted'
  | 'off-score'
  | 'finish-game'
  | 'engine-error';

export type SessionSnapshot = {
  phase: SessionPhase;
  position: TheoreticalEndgamePosition | null;
  fen: string;
  startFen: string | null;
  playerColor: 'w' | 'b';
  userMoves: number;
  objective: 'WIN' | 'DRAW';
  /** Bumps on start, retry and restore so speech does not replay history. */
  generation: number;
  startedAt: number;
  lastMove: { from: string; to: string } | null;
  lastFeedback: string | null;
  scoreLocked: boolean;
  offScore: boolean;
  result: TheoreticalAttemptResult | null;
  moveSans: string[];
  canOfferActions: boolean;
  finishGameActive: boolean;
  officialResultMessage: string | null;
};

export class TheoreticalEndgameSession {
  private game = new Chess();
  private position: TheoreticalEndgamePosition | null = null;
  private startFen: string | null = null;
  private phase: SessionPhase = 'idle';
  private analyzer: DefenseAnalyzer | null = null;
  private userMoves = 0;
  private moveSans: string[] = [];
  private lastMove: { from: string; to: string } | null = null;
  private lastFeedback: string | null = null;
  private scoreLocked = false;
  private offScore = false;
  private result: TheoreticalAttemptResult | null = null;
  private firstLoss: FirstTheoreticalLoss | null = null;
  private officialEndReason: TheoreticalAttemptResult['officialEndReason'];
  private fenBeforeLastPlayerMove: string | null = null;
  private finishGameMode = false;
  private lockedOutcome: TheoreticalAttemptResult['outcome'] | null = null;
  private checkmateWinner: 'w' | 'b' | undefined;
  private generation = 0;
  private startedAt = 0;
  private defense: DefenseAssessment | null = null;

  constructor(analyzer?: DefenseAnalyzer | null) {
    this.analyzer = analyzer ?? null;
  }

  setAnalyzer(analyzer: DefenseAnalyzer | null): void {
    this.analyzer = analyzer;
  }

  async start(position: TheoreticalEndgamePosition): Promise<SessionSnapshot> {
    this.position = position;
    this.startFen = position.initialFen;
    this.game = new Chess(position.initialFen);
    this.phase = 'playing';
    this.userMoves = 0;
    this.moveSans = [];
    this.lastMove = null;
    this.lastFeedback = null;
    this.scoreLocked = false;
    this.offScore = false;
    this.result = null;
    this.firstLoss = null;
    this.officialEndReason = undefined;
    this.fenBeforeLastPlayerMove = null;
    this.finishGameMode = false;
    this.lockedOutcome = null;
    this.checkmateWinner = undefined;
    this.generation += 1;
    this.startedAt = Date.now();
    this.defense = null;

    if (this.game.turn() !== playerToSide(position.playerColor)) {
      await this.playOpponent();
    }
    return this.snapshot();
  }

  async retry(): Promise<SessionSnapshot> {
    if (!this.position) return this.snapshot();
    return this.start(this.position);
  }

  abandon(): SessionSnapshot {
    if (this.scoreLocked) return this.snapshot();
    this.scoreLocked = true;
    this.phase = 'abandoned';
    this.result = this.buildResult('abandoned');
    return this.snapshot();
  }

  /**
   * Resume an in-progress snapshot, including one saved before this scale.
   * The current FEN and move list are kept. A line whose start position no
   * longer matches the catalog is graded without the new distance-to-mate.
   */
  restore(raw: {
    position?: TheoreticalEndgamePosition | null;
    fen?: string;
    startFen?: string | null;
    moveSans?: string[];
    userMoves?: number;
    startedAt?: number;
  }): SessionSnapshot {
    const stored = raw.position;
    if (!stored?.id || !raw.fen) return this.snapshot();
    const catalog = getPositionById(stored.id);
    const position = catalog ?? stored;
    let game: Chess;
    try {
      game = new Chess(raw.fen);
    } catch {
      return this.snapshot();
    }
    this.position = position;
    this.startFen = raw.startFen || position.initialFen;
    this.game = game;
    this.moveSans = [...(raw.moveSans ?? [])];
    this.userMoves = raw.userMoves ?? 0;
    this.phase = 'playing';
    this.lastMove = null;
    this.lastFeedback = null;
    this.scoreLocked = false;
    this.offScore = false;
    this.result = null;
    this.firstLoss = null;
    this.officialEndReason = undefined;
    this.fenBeforeLastPlayerMove = null;
    this.finishGameMode = false;
    this.lockedOutcome = null;
    this.checkmateWinner = undefined;
    this.defense = null;
    this.generation += 1;
    this.startedAt = typeof raw.startedAt === 'number' ? raw.startedAt : Date.now();
    return this.snapshot();
  }

  /** @deprecated use enterFinishGame */
  continueOffScore(): SessionSnapshot {
    return this.enterFinishGameSync();
  }

  enterFinishGameSync(): SessionSnapshot {
    if (!this.scoreLocked) return this.snapshot();
    this.finishGameMode = true;
    this.offScore = true;
    this.phase = 'finish-game';
    this.lastFeedback = null;
    return this.snapshot();
  }

  async enterFinishGame(): Promise<SessionSnapshot> {
    const snap = this.enterFinishGameSync();
    if (!this.position) return snap;
    const playerSide = playerToSide(this.position.playerColor);
    if (this.game.turn() !== playerSide && !this.game.isGameOver()) {
      await this.playOpponent();
    }
    return this.snapshot();
  }

  async startFinishGameFromState(input: {
    position: TheoreticalEndgamePosition;
    fen: string;
    moveSans: string[];
    lockedOutcome: TheoreticalAttemptResult['outcome'];
  }): Promise<SessionSnapshot> {
    this.position = input.position;
    this.startFen = input.position.initialFen;
    this.game = new Chess(input.fen);
    this.moveSans = [...input.moveSans];
    this.lastMove = null;
    this.lastFeedback = null;
    this.scoreLocked = true;
    this.offScore = true;
    this.lockedOutcome = input.lockedOutcome;
    this.result = this.buildResult(
      input.lockedOutcome === 'success' ? 'success' : 'theoretical-loss',
    );
    this.finishGameMode = true;
    this.phase = 'finish-game';
    return this.enterFinishGame();
  }

  getLegalDestinations(from: string): string[] {
    if (
      this.phase !== 'playing' &&
      this.phase !== 'off-score' &&
      this.phase !== 'finish-game'
    ) {
      return [];
    }
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
      (this.phase !== 'playing' &&
        this.phase !== 'off-score' &&
        this.phase !== 'finish-game') ||
      !this.position
    ) {
      return this.snapshot();
    }
    if (this.game.turn() !== playerToSide(this.position.playerColor)) {
      return this.snapshot();
    }

    let played: Move | null = null;
    try {
      played = this.game.move({
        from,
        to,
        promotion: promotion as 'q' | 'r' | 'b' | 'n',
      }) as Move;
    } catch {
      this.lastFeedback = tMsg('endgame.illegalMove');
      return this.snapshot();
    }
    if (!played) {
      this.lastFeedback = tMsg('endgame.illegalMove');
      return this.snapshot();
    }

    this.fenBeforeLastPlayerMove = this.game.fen();
    const beforeFen = this.fenBeforeLastPlayerMove;
    this.lastMove = { from: played.from, to: played.to };
    this.moveSans.push(played.san);

    if (!this.offScore && !this.scoreLocked && !this.finishGameMode) {
      this.userMoves += 1;
    }

    // Regulatory success check
    const reg = evaluateRegulatoryEnd(this.game);
    if (reg) {
      if (this.finishGameMode) {
        return this.handleFinishGameRegulatory(reg);
      }
      if (!this.scoreLocked) {
        return this.handleRegulatory(reg, played.san, beforeFen);
      }
    }

    if (!this.analyzer) {
      this.phase = 'engine-error';
      this.lastFeedback = tMsg('endgame.stockfishUnavailable');
      return this.snapshot();
    }

    // Theoretical loss check (only when scored, not in finish-game)
    if (!this.offScore && !this.scoreLocked && !this.finishGameMode) {
      const lost = await this.checkTheoreticalLoss(played.san, beforeFen);
      if (lost || this.scoreLocked) return this.snapshot();
      if (this.maybeEndScoredPlay()) return this.snapshot();
    }

    this.fenBeforeLastPlayerMove = this.game.fen();
    await this.playOpponent();
    if (!this.scoreLocked && !this.offScore && !this.finishGameMode) {
      this.maybeEndScoredPlay();
    }
    return this.snapshot();
  }

  async answerSan(san: string): Promise<SessionSnapshot> {
    const clone = new Chess(this.game.fen());
    let move: Move | null = null;
    try {
      move = clone.move(san) as Move;
    } catch {
      this.lastFeedback = tMsg('endgame.moveNotRecognized');
      return this.snapshot();
    }
    if (!move) {
      this.lastFeedback = tMsg('endgame.moveNotRecognized');
      return this.snapshot();
    }
    return this.attemptMove(move.from, move.to, move.promotion ?? 'q');
  }

  private handleFinishGameRegulatory(
    reg: NonNullable<ReturnType<typeof evaluateRegulatoryEnd>>,
  ): SessionSnapshot {
    const pos = this.position!;
    if (reg.kind === 'checkmate') {
      this.lastFeedback =
        theoreticalOfficialResultMessage({
          outcome: this.lockedOutcome ?? 'success',
          playerColor: pos.playerColor,
          objective: pos.objective,
          checkmateWinner: reg.winner,
        }) ?? tMsg('theoretical.gameOver');
    } else {
      this.officialEndReason = reg.reason;
      this.lastFeedback =
        theoreticalOfficialResultMessage({
          outcome: 'success',
          playerColor: pos.playerColor,
          objective: pos.objective,
          officialEndReason: reg.reason,
        }) ?? tMsg('theoretical.drawObtained');
    }
    this.phase = 'finish-game';
    return this.snapshot();
  }

  private handleRegulatory(
    reg: NonNullable<ReturnType<typeof evaluateRegulatoryEnd>>,
    san: string,
    beforeFen: string | null,
  ): SessionSnapshot {
    const pos = this.position!;
    if (reg.kind === 'checkmate') {
      const winner = reg.winner;
      this.checkmateWinner = winner;
      const playerWon = winner === playerToSide(pos.playerColor);
      // A defender who actually wins has met "at least a draw".
      if (playerWon) {
        this.finishSuccess('checkmate');
      } else {
        this.finishTheoreticalLoss(san, beforeFen ?? this.startFen!, 'LOSS');
      }
      return this.snapshot();
    }

    // Official draw
    if (pos.objective === 'DRAW') {
      this.officialEndReason = reg.reason;
      this.finishSuccess(reg.reason);
    } else {
      this.finishTheoreticalLoss(san, beforeFen ?? this.startFen!, 'DRAW');
    }
    return this.snapshot();
  }

  private async checkTheoreticalLoss(
    san: string,
    beforeFen: string | null,
  ): Promise<boolean> {
    if (!this.position || !this.analyzer) return false;
    const thinkMs = THEORETICAL_ENDGAME_CONFIG.thinkTimeMs;
    let analysis: DefenseAnalysis;
    try {
      analysis = await this.analyzer.analyze(this.game.fen(), thinkMs);
    } catch {
      return false;
    }
    if (this.scoreLocked || this.phase === 'abandoned' || this.phase === 'interrupted') {
      return false;
    }

    const probe = {
      fen: this.game.fen(),
      wdl: analysis.wdl ?? null,
      mateIn: analysis.mateIn,
      scoreCp: analysis.scoreCp,
    };

    const stm = sideToMoveFromFen(this.game.fen());
    let resultAfter = wdlToPlayerResult(analysis.wdl, stm, this.position.playerColor);
    if (analysis.mateIn != null) {
      const same = stm === playerToSide(this.position.playerColor);
      if (same && analysis.mateIn > 0) resultAfter = 'WIN';
      else if (same && analysis.mateIn < 0) resultAfter = 'LOSS';
      else if (!same && analysis.mateIn > 0) resultAfter = 'LOSS';
      else if (!same && analysis.mateIn < 0) resultAfter = 'WIN';
    }

    if (!resultAfter || !lostTheoreticalObjective(this.position.objective, resultAfter)) {
      return false;
    }

    this.phase = 'verifying';
    if (this.scoreLocked) return false;
    let confirmation: DefenseAnalysis | null = null;
    try {
      confirmation = await this.analyzer.analyze(
        this.game.fen(),
        THEORETICAL_ENDGAME_CONFIG.confirmThinkMs,
      );
    } catch {
      confirmation = null;
    }

    const verdict = verifyTheoreticalLoss(
      this.position.objective,
      this.position.playerColor,
      probe,
      confirmation
        ? {
            fen: this.game.fen(),
            wdl: confirmation.wdl ?? null,
            mateIn: confirmation.mateIn,
            scoreCp: confirmation.scoreCp,
          }
        : null,
    );

    if (this.scoreLocked) return false;
    if (verdict.lost) {
      this.finishTheoreticalLoss(
        san,
        beforeFen ?? this.startFen!,
        verdict.resultAfter,
      );
      return true;
    }
    return false;
  }

  /** Theme mechanism, or the technical cap. The cap is not a grade of 0. */
  private maybeEndScoredPlay(): boolean {
    if (this.scoreLocked || this.finishGameMode || this.offScore || !this.position) return false;
    this.refreshDefense();
    if (this.defense?.complete) {
      this.finishSuccess('position-defended');
      return true;
    }
    if (this.userMoves >= THEORETICAL_ENDGAME_CONFIG.technicalUserMoveCap) {
      this.scoreLocked = true;
      this.phase = 'interrupted';
      this.result = this.buildResult('interrupted');
      this.lastFeedback = null;
      return true;
    }
    return false;
  }

  private refreshDefense(): void {
    if (!this.position) return;
    this.defense = assessDefense({
      themeId: this.position.themeId,
      initialFen: this.startFen ?? this.position.initialFen,
      sans: this.moveSans,
      playerColor: this.position.playerColor,
      objective: this.position.objective,
    });
  }

  private matePliesForGrade(): number | null {
    const pos = this.position;
    if (!pos || pos.objective !== 'WIN') return null;
    const start = (this.startFen ?? '').split(' ')[0];
    const catalog = pos.initialFen.split(' ')[0];
    if (start !== catalog) return null;
    const proof = pos.proof;
    if (!proof || proof.confidence !== 'exact' || proof.dtm == null || proof.dtm <= 0) return null;
    return proof.dtm;
  }

  private finishSuccess(reason: TheoreticalAttemptResult['officialEndReason']): void {
    this.refreshDefense();
    this.scoreLocked = true;
    this.officialEndReason = reason;
    this.phase = 'success';
    this.result = this.buildResult('success');
    this.lastFeedback =
      this.result.officialResultMessage ??
      (this.position?.objective === 'WIN'
        ? tMsg('endgame.positionWon')
        : tMsg('endgame.drawAchieved'));
  }

  private finishTheoreticalLoss(
    san: string,
    beforeFen: string,
    resultAfter: PlayerTheoreticalResult,
  ): void {
    this.scoreLocked = true;
    this.phase = 'theoretical-loss';
    this.firstLoss = {
      playerMoveNumber: this.userMoves,
      san,
      fenBefore: beforeFen,
      fenAfter: this.game.fen(),
      expectedResult: this.position!.objective,
      resultAfter,
      message: tMsg('endgame.firstTurn', { move: this.userMoves, san }),
    };
    this.result = this.buildResult('theoretical-loss');
    this.lastFeedback = tMsg('theoretical.lostOnMove', { count: this.userMoves });
  }

  private async playOpponent(): Promise<void> {
    if (!this.analyzer || !this.position) return;
    if (this.game.isGameOver()) {
      const reg = evaluateRegulatoryEnd(this.game);
      if (reg) {
        if (this.finishGameMode) this.handleFinishGameRegulatory(reg);
        else this.handleRegulatory(reg, '', this.fenBeforeLastPlayerMove);
      }
      return;
    }

    if (this.scoreLocked && !this.finishGameMode) return;
    this.phase = 'thinking';
    const thinkMs = this.finishGameMode
      ? 1000
      : THEORETICAL_ENDGAME_CONFIG.thinkTimeMs;
    let analysis: DefenseAnalysis;
    try {
      analysis = await this.analyzer.analyze(this.game.fen(), thinkMs);
    } catch {
      if (this.scoreLocked) return;
      this.phase = 'engine-error';
      this.lastFeedback = tMsg('endgame.engineError');
      return;
    }
    if (this.scoreLocked && !this.finishGameMode) return;

    const pick = chooseStrictBestMove(analysis);
    if (!pick) {
      this.phase = this.offScore ? 'off-score' : 'playing';
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
      this.phase = this.offScore ? 'off-score' : 'playing';
      return;
    }

    const reg = evaluateRegulatoryEnd(this.game);
    if (reg) {
      if (this.finishGameMode) this.handleFinishGameRegulatory(reg);
      else this.handleRegulatory(reg, '', this.fenBeforeLastPlayerMove);
      return;
    }

    if (this.finishGameMode) {
      this.phase = 'finish-game';
    } else if (this.offScore) {
      this.phase = 'off-score';
    } else if (!this.scoreLocked) {
      this.phase = 'playing';
      this.lastFeedback = null;
    }
  }

  private buildResult(outcome: TheoreticalAttemptResult['outcome']): TheoreticalAttemptResult {
    const pos = this.position!;
    if (!this.defense) this.refreshDefense();
    const mechanism =
      this.defense?.applicable
        ? { demonstrated: this.defense.demonstrated, slackMoves: this.defense.slackMoves }
        : null;
    const quality = gradeQuality({
      outcome,
      objective: pos.objective,
      userMoves: this.userMoves,
      initialMatePlies: this.matePliesForGrade(),
      mechanism,
    });

    const officialResultMessage = theoreticalOfficialResultMessage({
      outcome: outcome === 'interrupted' ? 'abandoned' : outcome,
      playerColor: pos.playerColor,
      objective: pos.objective,
      officialEndReason: this.officialEndReason,
      checkmateWinner: this.checkmateWinner,
    });

    return {
      outcome,
      positionId: pos.id,
      themeId: pos.themeId,
      objective: pos.objective,
      objectiveKind: pos.objectiveKind ?? 'win',
      playerColor: pos.playerColor,
      userMoves: this.userMoves,
      scoreScale: 'quality-5',
      attemptScore: quality.score,
      quality,
      durationMs: Math.max(0, Date.now() - this.startedAt),
      firstTheoreticalLoss: this.firstLoss,
      startFen: this.startFen ?? this.game.fen(),
      endFen: this.game.fen(),
      moveSans: [...this.moveSans],
      officialEndReason: this.officialEndReason,
      officialResultMessage,
      finishedAt: new Date().toISOString(),
      offScore: this.offScore,
    };
  }

  snapshot(): SessionSnapshot {
    return {
      phase: this.phase,
      position: this.position,
      fen: this.game.fen(),
      startFen: this.startFen,
      playerColor: this.position ? playerToSide(this.position.playerColor) : 'w',
      userMoves: this.userMoves,
      objective: this.position?.objective ?? 'WIN',
      generation: this.generation,
      startedAt: this.startedAt,
      lastMove: this.lastMove,
      lastFeedback: this.lastFeedback,
      scoreLocked: this.scoreLocked,
      offScore: this.offScore,
      result: this.result,
      moveSans: [...this.moveSans],
      canOfferActions:
        this.phase === 'success' || this.phase === 'theoretical-loss',
      finishGameActive: this.finishGameMode,
      officialResultMessage:
        this.result?.officialResultMessage ??
        (this.phase === 'theoretical-loss' ? null : this.lastFeedback),
    };
  }
}
