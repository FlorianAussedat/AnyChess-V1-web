/**
 * Adapter: push a theoretical attempt into Game Library + shared session,
 * then open the unified Lecteur / Analyseur.
 */
import {
  buildAnalyzerHref,
  type AnalyzerHref,
} from '../../gameLibrary/openPgnInAnalyzer.ts';
import {
  openExerciseGameInAnalyzer,
  openExercisePositionInAnalyzer,
} from '../../gameLibrary/openExerciseAnalyzer.ts';
import type { GameLibraryStore } from '../../gameLibrary/GameLibraryStore.ts';
import type { EvaluationPoint, FirstMajorTurn } from '../../endgameTraining/domain/types.ts';
import type { TheoreticalAttemptResult } from '../domain/types.ts';

export type TheoreticalAnalysisPayload = {
  positionId: string;
  themeId: string;
  startFen: string;
  orientation: 'white' | 'black';
  moveSans: string[];
  firstTheoreticalLoss: TheoreticalAttemptResult['firstTheoreticalLoss'];
  firstMajorTurn: FirstMajorTurn | null;
  objective: 'WIN' | 'DRAW';
  userMoves: number;
  targetUserMoves: number;
  outcome: TheoreticalAttemptResult['outcome'];
  timeline: EvaluationPoint[];
};

const overlayByGameId = new Map<string, TheoreticalAnalysisPayload>();

export function getTheoreticalAnalysisOverlay(
  gameId: string,
): TheoreticalAnalysisPayload | null {
  return overlayByGameId.get(gameId) ?? null;
}

function resultTag(result: TheoreticalAttemptResult): string {
  if (result.outcome !== 'success') return '*';
  if (result.objective === 'WIN') {
    return result.playerColor === 'white' ? '1-0' : '0-1';
  }
  return '1/2-1/2';
}

function stashOverlay(gameId: string, result: TheoreticalAttemptResult): void {
  overlayByGameId.set(gameId, {
    positionId: result.positionId,
    themeId: result.themeId,
    startFen: result.startFen,
    orientation: result.playerColor,
    moveSans: result.moveSans,
    firstTheoreticalLoss: result.firstTheoreticalLoss,
    firstMajorTurn: result.firstTheoreticalLoss
      ? {
          playerMoveNumber: result.firstTheoreticalLoss.playerMoveNumber,
          san: result.firstTheoreticalLoss.san,
          scoreBefore: 0,
          scoreAfter: 0,
          delta: 0,
          message: result.firstTheoreticalLoss.message,
        }
      : null,
    objective: result.objective,
    userMoves: result.userMoves,
    targetUserMoves: result.targetUserMoves,
    outcome: result.outcome,
    timeline: [],
  });
}

export async function openTheoreticalInReader(input: {
  result: TheoreticalAttemptResult;
  routerPush: (href: AnalyzerHref) => void;
  store?: GameLibraryStore;
  /** `game` = startFen + moves; `position` = terminal FEN only. */
  mode?: 'game' | 'position';
}): Promise<string | null> {
  const flipped = input.result.playerColor === 'black';
  const mode = input.mode ?? 'game';

  const opened =
    mode === 'position'
      ? await openExercisePositionInAnalyzer({
          fen: input.result.endFen,
          flipped,
        })
      : await openExerciseGameInAnalyzer({
          startFen: input.result.startFen,
          moveSans: input.result.moveSans,
          event: 'Finales théoriques',
          fileName: 'theoretical-endgame.pgn',
          displayName: 'Finales théoriques',
          flipped,
          resultTag: resultTag(input.result),
          extraHeaders: { Orientation: input.result.playerColor },
          store: input.store,
        });

  if (!opened) return null;
  if (mode === 'game') stashOverlay(opened.gameId, input.result);
  input.routerPush(
    opened.href ??
      buildAnalyzerHref(opened.gameId, { flipped, tab: 'analysis' }),
  );
  return opened.gameId;
}
