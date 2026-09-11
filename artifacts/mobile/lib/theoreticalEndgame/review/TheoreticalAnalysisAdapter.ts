/**
 * Adapter: push a theoretical attempt into Game Library + open Lecteur.
 */
import {
  buildAnalyzerHref,
  openPgnInAnalyzer,
  type AnalyzerHref,
} from '../../gameLibrary/openPgnInAnalyzer.ts';
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

function buildPgn(input: {
  startFen: string;
  moveSans: string[];
  playerColor: 'white' | 'black';
  result: string;
}): string {
  const headers = [
    `[Event "Finales théoriques"]`,
    `[Site "AnyChess"]`,
    `[Result "${input.result}"]`,
    `[FEN "${input.startFen}"]`,
    `[SetUp "1"]`,
    `[Orientation "${input.playerColor}"]`,
  ];
  const moves: string[] = [];
  let moveNum = 1;
  let whiteToMove = input.startFen.split(' ')[1] !== 'b';
  for (const san of input.moveSans) {
    if (whiteToMove) {
      moves.push(`${moveNum}. ${san}`);
      whiteToMove = false;
    } else {
      moves.push(san);
      whiteToMove = true;
      moveNum += 1;
    }
  }
  return `${headers.join('\n')}\n\n${moves.join(' ')} ${input.result}\n`;
}

export async function openTheoreticalInReader(input: {
  result: TheoreticalAttemptResult;
  routerPush: (href: AnalyzerHref) => void;
  store?: GameLibraryStore;
}): Promise<string | null> {
  const resultTag =
    input.result.outcome === 'success'
      ? input.result.objective === 'WIN'
        ? input.result.playerColor === 'white'
          ? '1-0'
          : '0-1'
        : '1/2-1/2'
      : '*';

  const pgn = buildPgn({
    startFen: input.result.startFen,
    moveSans: input.result.moveSans,
    playerColor: input.result.playerColor,
    result: resultTag,
  });

  const opened = await openPgnInAnalyzer({
    pgnText: pgn,
    fileName: 'theoretical-endgame.pgn',
    displayName: 'Finales théoriques',
    flipped: input.result.playerColor === 'black',
    tab: 'analysis',
    store: input.store,
  });
  if (!opened) return null;

  const payload: TheoreticalAnalysisPayload = {
    positionId: input.result.positionId,
    themeId: input.result.themeId,
    startFen: input.result.startFen,
    orientation: input.result.playerColor,
    moveSans: input.result.moveSans,
    firstTheoreticalLoss: input.result.firstTheoreticalLoss,
    firstMajorTurn: input.result.firstTheoreticalLoss
      ? {
          playerMoveNumber: input.result.firstTheoreticalLoss.playerMoveNumber,
          san: input.result.firstTheoreticalLoss.san,
          scoreBefore: 0,
          scoreAfter: 0,
          delta: 0,
          message: input.result.firstTheoreticalLoss.message,
        }
      : null,
    objective: input.result.objective,
    userMoves: input.result.userMoves,
    targetUserMoves: input.result.targetUserMoves,
    outcome: input.result.outcome,
    timeline: [],
  };
  overlayByGameId.set(opened.gameId, payload);
  input.routerPush(
    opened.href ??
      buildAnalyzerHref(opened.gameId, {
        flipped: input.result.playerColor === 'black',
        tab: 'analysis',
      }),
  );
  return opened.gameId;
}
