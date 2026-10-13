/**
 * Independent grade of a recorded line from the board, without the engine.
 * Used to check that published scores match the pedagogical measure.
 */
import { assessDefense } from '../domain/defenseFinish.ts';
import { assessMateDrive } from '../domain/mateDrive.ts';
import { assessPawnWin } from '../domain/pawnWinProgress.ts';
import { gradeFamilyFor, type GradeFamily } from '../domain/gradeFamily.ts';
import { gradeQuality } from '../domain/comprehensionScore.ts';
import type { TheoreticalEndgamePosition } from '../domain/types.ts';
import { replayRecordedLine, type PlayTowardResult } from './playTowardObjective.ts';

export type ReferenceGrade = {
  family: GradeFamily;
  played: PlayTowardResult;
  demonstrated: boolean;
  slackMoves: number;
  score: number | null;
  extra: number | null;
  reason: string | null;
};

export function referenceGrade(
  position: TheoreticalEndgamePosition,
  sans: string[],
): ReferenceGrade {
  const played = replayRecordedLine(position, sans);
  const family = gradeFamilyFor(position.themeId, position.objective);
  if (family === 'defense') {
    const defense = assessDefense({
      themeId: position.themeId,
      initialFen: position.initialFen,
      sans: played.sans,
      playerColor: position.playerColor,
      objective: 'DRAW',
    });
    const quality = gradeQuality({
      outcome: played.outcome === 'success' ? 'success' : 'interrupted',
      objective: 'DRAW',
      userMoves: played.userMoves,
      mechanism: { demonstrated: defense.demonstrated, slackMoves: defense.slackMoves },
    });
    return {
      family,
      played,
      demonstrated: defense.demonstrated,
      slackMoves: defense.slackMoves,
      score: quality.score,
      extra: quality.extra,
      reason: quality.reason,
    };
  }
  if (family === 'pawn-win') {
    const progress = assessPawnWin({
      themeId: position.themeId,
      initialFen: position.initialFen,
      sans: played.sans,
      playerColor: position.playerColor,
      objective: 'WIN',
    });
    const quality = gradeQuality({
      outcome: played.outcome === 'success' ? 'success' : 'interrupted',
      objective: 'WIN',
      userMoves: played.userMoves,
      progress: { demonstrated: progress.demonstrated, slackMoves: progress.slackMoves },
    });
    return {
      family,
      played,
      demonstrated: progress.demonstrated,
      slackMoves: progress.slackMoves,
      score: quality.score,
      extra: quality.extra,
      reason: quality.reason,
    };
  }
  const drive = assessMateDrive({
    initialFen: position.initialFen,
    sans: played.sans,
    playerColor: position.playerColor,
  });
  const quality = gradeQuality({
    outcome: played.outcome === 'success' ? 'success' : 'interrupted',
    objective: 'WIN',
    userMoves: played.userMoves,
    progress: { demonstrated: drive.demonstrated, slackMoves: drive.slackMoves },
  });
  return {
    family,
    played,
    demonstrated: drive.demonstrated,
    slackMoves: drive.slackMoves,
    score: quality.score,
    extra: quality.extra,
    reason: quality.reason,
  };
}
