/**
 * Adapter: push an endgame attempt into Game Library + shared session,
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
import type { AttemptResult, EvaluationPoint, FirstMajorTurn } from '../domain/types.ts';

export type EndgameAnalysisPayload = {
  positionId: string;
  startFen: string;
  orientation: 'white' | 'black';
  moveSans: string[];
  timeline: EvaluationPoint[];
  firstMajorTurn: FirstMajorTurn | null;
  lossThresholdCp: number;
  movesResisted: number;
  outcome: AttemptResult['outcome'];
};

const overlayByGameId = new Map<string, EndgameAnalysisPayload>();

export function getEndgameAnalysisOverlay(
  gameId: string,
): EndgameAnalysisPayload | null {
  return overlayByGameId.get(gameId) ?? null;
}

export function clearEndgameAnalysisOverlay(gameId: string): void {
  overlayByGameId.delete(gameId);
}

function resultTag(result: AttemptResult): string {
  if (result.outcome === 'loss') return '0-1';
  if (result.outcome.startsWith('win')) return '1/2-1/2';
  return '*';
}

function stashOverlay(
  gameId: string,
  result: AttemptResult,
  defender: 'white' | 'black',
): void {
  overlayByGameId.set(gameId, {
    positionId: result.positionId,
    startFen: result.startFen,
    orientation: defender,
    moveSans: result.moveSans,
    timeline: result.timeline,
    firstMajorTurn: result.firstMajorTurn ?? null,
    lossThresholdCp: -200,
    movesResisted: result.movesResisted,
    outcome: result.outcome,
  });
}

export async function openEndgameInReader(input: {
  result: AttemptResult;
  defender: 'white' | 'black';
  routerPush: (href: AnalyzerHref) => void;
  store?: GameLibraryStore;
  /** `game` = startFen + moves; `position` = terminal FEN only. */
  mode?: 'game' | 'position';
}): Promise<string | null> {
  const flipped = input.defender === 'black';
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
          event: 'Entraînement aux Finales',
          fileName: 'endgame-training.pgn',
          displayName: 'Entraînement aux Finales',
          flipped,
          resultTag: resultTag(input.result),
          extraHeaders: { Orientation: input.defender },
          store: input.store,
        });

  if (!opened) return null;
  if (mode === 'game') stashOverlay(opened.gameId, input.result, input.defender);
  input.routerPush(
    opened.href ??
      buildAnalyzerHref(opened.gameId, { flipped, tab: 'analysis' }),
  );
  return opened.gameId;
}
