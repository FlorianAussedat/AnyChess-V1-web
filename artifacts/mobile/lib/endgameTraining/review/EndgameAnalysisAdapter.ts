/**
 * Adapter: push an endgame attempt into the Game Library + open Lecteur.
 * Stores analysis overlay payload keyed by game id for the reader to pick up.
 */
import { gameLibraryStore } from '../../gameLibrary/GameLibraryStore.ts';
import type { AttemptResult, EvaluationPoint, FirstMajorTurn } from '../domain/types.ts';
import type { AnalysisMarker } from '../../workspace/types.ts';

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

export function buildEndgameMarkers(payload: EndgameAnalysisPayload): AnalysisMarker[] {
  if (!payload.firstMajorTurn) return [];
  return [
    {
      id: 'endgame-objective-lost',
      ply: payload.firstMajorTurn.playerMoveNumber,
      type: 'objective-lost',
      label: payload.firstMajorTurn.message,
    },
  ];
}

export function buildEndgameEvaluations(
  payload: EndgameAnalysisPayload,
): Array<{ ply: number; scoreCp: number; mateIn: number | null }> {
  const startStm = payload.startFen.split(' ')[1] === 'b' ? 'black' : 'white';
  const player = payload.orientation;
  const evaluations: Array<{ ply: number; scoreCp: number; mateIn: number | null }> = [];
  let playerMoveNum = 0;
  let mover: 'white' | 'black' = startStm;
  for (let i = 0; i < payload.moveSans.length; i++) {
    if (mover === player) {
      playerMoveNum += 1;
      const point = payload.timeline.find((p) => p.playerMoveNumber === playerMoveNum);
      if (point) {
        evaluations.push({
          ply: i + 1,
          scoreCp: point.scoreCp,
          mateIn: point.mateIn,
        });
      }
    }
    mover = mover === 'white' ? 'black' : 'white';
  }
  return evaluations;
}

export async function openEndgameInReader(input: {
  result: AttemptResult;
  defender: 'white' | 'black';
  routerPush: (href: string) => void;
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

  const imported = await gameLibraryStore.importPgnText(pgn, 'endgame-training.pgn');
  const game = imported.imported[0];
  if (!game) return null;

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
  overlayByGameId.set(game.id, payload);
  input.routerPush(`/parties/${game.id}`);
  return game.id;
}
