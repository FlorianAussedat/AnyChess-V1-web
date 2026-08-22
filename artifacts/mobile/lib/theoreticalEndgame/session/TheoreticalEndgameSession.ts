/**
 * TheoreticalEndgameSession — authoritative rules for « Finales théoriques ».
 */
import { Chess, type Move, type Square } from 'chess.js';
import type { DefenseAnalyzer, DefenseAnalysis } from '../../defendDraw/defenseTypes.ts';
import { chooseStrictBestMove } from '../../engines/policies/StrictBestPolicy.ts';
import { THEORETICAL_ENDGAME_CONFIG, type TheoreticalEndgamePosition, type TheoreticalAttemptResult, type FirstTheoreticalLoss } from '../domain/types.ts';
import { scoreAttempt } from '../domain/comprehensionScore.ts';
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

export type SessionPhase =
  | 'idle'
  | 'playing'
  | 'thinking'
  | 'verifying'
  | 'success'
  | 'theoretical-loss'
  | 'abandoned'
  | 'off-score'
  | 'engine-error';

export type SessionSnapshot = {
  phase: SessionPhase;
  position: TheoreticalEndgamePosition | null;
  fen: string;
  startFen: string | null;
  playerColor: 'w' | 'b';
  userMoves: number;
  targetUserMoves: number;
  objective: 'WIN' | 'DRAW';
  lastMove: { from: string; to: string } | null;
  lastFeedback: string | null;
  scoreLocked: boolean;
  offScore: boolean;
  result: TheoreticalAttemptResult | null;
  moveSans: string[];
  canOfferActions: boolean;
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
    this.phase = 'abandoned';
    this.result = this.buildResult('abandoned');
    return this.snapshot();
  }

  continueOffScore(): SessionSnapshot {
    if (!this.scoreLocked) return this.snapshot();
    this.offScore = true;
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
      this.lastFeedback = 'Coup illégal.';
      return this.snapshot();
    }
    if (!played) {
      this.lastFeedback = 'Coup illégal.';
      return this.snapshot();
    }

    this.fenBeforeLastPlayerMove = this.game.fen();
    const beforeFen = this.fenBeforeLastPlayerMove;
    this.lastMove = { from: played.from, to: played.to };
    this.moveSans.push(played.san);

    if (!this.offScore && !this.scoreLocked) {
      this.userMoves += 1;
    }

    // Regulatory success check
    const reg = evaluateRegulatoryEnd(this.game);
    if (reg && !this.scoreLocked) {
      return this.handleRegulatory(reg, played.san, beforeFen);
    }

    if (!this.analyzer) {
      this.phase = 'engine-error';
      this.lastFeedback = 'Stockfish indisponible.';
      return this.snapshot();
    }

    // Theoretical loss check (only when scored)
    if (!this.offScore && !this.scoreLocked) {
      const lost = await this.checkTheoreticalLoss(played.san, beforeFen);
      if (lost) return this.snapshot();
    }

    this.fenBeforeLastPlayerMove = this.game.fen();
    await this.playOpponent();
    return this.snapshot();
  }

  async answerSan(san: string): Promise<SessionSnapshot> {
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

  private handleRegulatory(
    reg: NonNullable<ReturnType<typeof evaluateRegulatoryEnd>>,
    san: string,
    beforeFen: string | null,
  ): SessionSnapshot {
    const pos = this.position!;
    if (reg.kind === 'checkmate') {
      const winner = reg.winner;
      const playerWon = winner === playerToSide(pos.playerColor);
      if (playerWon && pos.objective === 'WIN') {
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

  private finishSuccess(reason: TheoreticalAttemptResult['officialEndReason']): void {
    this.scoreLocked = true;
    this.officialEndReason = reason;
    this.phase = 'success';
    this.result = this.buildResult('success');
    this.lastFeedback =
      this.position?.objective === 'WIN'
        ? 'Position gagnée !'
        : 'Nulle obtenue !';
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
      message: `Premier coup perdant : ${this.userMoves}.${san}`,
    };
    this.result = this.buildResult('theoretical-loss');
    this.lastFeedback = `Résultat théorique perdu au ${this.userMoves}e coup.`;
  }

  private async playOpponent(): Promise<void> {
    if (!this.analyzer || !this.position) return;
    if (this.game.isGameOver()) {
      const reg = evaluateRegulatoryEnd(this.game);
      if (reg) this.handleRegulatory(reg, '', this.fenBeforeLastPlayerMove);
      return;
    }

    this.phase = 'thinking';
    let analysis: DefenseAnalysis;
    try {
      analysis = await this.analyzer.analyze(
        this.game.fen(),
        THEORETICAL_ENDGAME_CONFIG.thinkTimeMs,
      );
    } catch {
      this.phase = 'engine-error';
      this.lastFeedback = 'Erreur moteur.';
      return;
    }

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
      this.handleRegulatory(reg, '', this.fenBeforeLastPlayerMove);
      return;
    }

    if (this.offScore) {
      this.phase = 'off-score';
    } else if (!this.scoreLocked) {
      this.phase = 'playing';
      this.lastFeedback = null;
    }
  }

  private buildResult(outcome: TheoreticalAttemptResult['outcome']): TheoreticalAttemptResult {
    const pos = this.position!;
    const attemptScore =
      outcome === 'success'
        ? scoreAttempt({
            outcome,
            userMoves: this.userMoves,
            targetUserMoves: pos.targetUserMoves,
          })
        : outcome === 'theoretical-loss'
          ? 0
          : 0;

    return {
      outcome,
      positionId: pos.id,
      themeId: pos.themeId,
      objective: pos.objective,
      playerColor: pos.playerColor,
      userMoves: this.userMoves,
      targetUserMoves: pos.targetUserMoves,
      attemptScore,
      firstTheoreticalLoss: this.firstLoss,
      startFen: this.startFen ?? this.game.fen(),
      endFen: this.game.fen(),
      moveSans: [...this.moveSans],
      officialEndReason: this.officialEndReason,
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
      targetUserMoves: this.position?.targetUserMoves ?? 0,
      objective: this.position?.objective ?? 'WIN',
      lastMove: this.lastMove,
      lastFeedback: this.lastFeedback,
      scoreLocked: this.scoreLocked,
      offScore: this.offScore,
      result: this.result,
      moveSans: [...this.moveSans],
      canOfferActions:
        this.phase === 'success' || this.phase === 'theoretical-loss',
    };
  }
}
