/**
 * Adapter: push an endgame attempt into the Game Library + open Lecteur.
 * Stores analysis overlay payload keyed by game id for the reader to pick up.
 */
import {
  buildAnalyzerHref,
  openPgnInAnalyzer,
  type AnalyzerHref,
} from '../../gameLibrary/openPgnInAnalyzer.ts';
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

function buildPgn(input: {
  startFen: string;
  moveSans: string[];
  defender: 'white' | 'black';
  result: string;
}): string {
  const headers = [
    `[Event "Entraînement aux Finales"]`,
    `[Site "AnyChess"]`,
    `[Result "${input.result}"]`,
    `[FEN "${input.startFen}"]`,
    `[SetUp "1"]`,
    `[Orientation "${input.defender}"]`,
  ];
  const moves: string[] = [];
  let moveNum = 1;
  // Detect who moves first from FEN
  const stm = input.startFen.split(' ')[1] === 'b' ? 'b' : 'w';
  let whiteToMove = stm === 'w';
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

export async function openEndgameInReader(input: {
  result: AttemptResult;
  defender: 'white' | 'black';
  routerPush: (href: AnalyzerHref) => void;
  store?: GameLibraryStore;
}): Promise<string | null> {
  const resultTag =
    input.result.outcome === 'loss'
      ? '0-1'
      : input.result.outcome.startsWith('win')
        ? '1/2-1/2'
        : '*';

  const pgn = buildPgn({
    startFen: input.result.startFen,
    moveSans: input.result.moveSans,
    defender: input.defender,
    result: resultTag,
  });

  const opened = await openPgnInAnalyzer({
    pgnText: pgn,
    fileName: 'endgame-training.pgn',
    displayName: 'Entraînement aux Finales',
    flipped: input.defender === 'black',
    tab: 'analysis',
    store: input.store,
  });
  if (!opened) return null;

  const payload: EndgameAnalysisPayload = {
    positionId: input.result.positionId,
    startFen: input.result.startFen,
    orientation: input.defender,
    moveSans: input.result.moveSans,
    timeline: input.result.timeline,
    firstMajorTurn: input.result.firstMajorTurn ?? null,
    lossThresholdCp: -200,
    movesResisted: input.result.movesResisted,
    outcome: input.result.outcome,
  };
  overlayByGameId.set(opened.gameId, payload);
  input.routerPush(
    opened.href ??
      buildAnalyzerHref(opened.gameId, {
        flipped: input.defender === 'black',
        tab: 'analysis',
      }),
  );
  return opened.gameId;
}
