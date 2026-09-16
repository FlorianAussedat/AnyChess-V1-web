/**
 * Build player-POV evaluation timeline for Lecteur analysis.
 */
import { Chess } from 'chess.js';
import type { DefenseAnalyzer } from '../../defendDraw/defenseTypes.ts';
import type { EvaluationPoint } from '../../endgameTraining/domain/types.ts';
import type { PlayerColor } from '../domain/types.ts';
import { playerToSide } from '../domain/theoreticalResult.ts';

function scoreToPlayerPov(
  scoreCp: number,
  mateIn: number | null,
  sideToMove: 'w' | 'b',
  playerColor: PlayerColor,
): { scoreCp: number; mateIn: number | null } {
  const playerSide = playerToSide(playerColor);
  const flip = sideToMove !== playerSide;
  if (mateIn != null) {
    const m = flip ? -mateIn : mateIn;
    return { scoreCp: m > 0 ? 10000 : -10000, mateIn: m };
  }
  return { scoreCp: flip ? -scoreCp : scoreCp, mateIn: null };
}

export async function buildTheoreticalTimeline(input: {
  startFen: string;
  moveSans: string[];
  playerColor: PlayerColor;
  analyzer: DefenseAnalyzer;
  thinkTimeMs?: number;
}): Promise<EvaluationPoint[]> {
  const thinkMs = input.thinkTimeMs ?? 400;
  const game = new Chess(input.startFen);
  const playerSide = playerToSide(input.playerColor);
  const timeline: EvaluationPoint[] = [];

  const initial = await input.analyzer.analyze(input.startFen, thinkMs);
  const stm0 = game.turn();
  const initPov = scoreToPlayerPov(
    initial.scoreCp,
    initial.mateIn,
    stm0,
    input.playerColor,
  );
  timeline.push({
    afterPlayerMove: 0,
    playerMoveNumber: 0,
    fen: input.startFen,
    scoreCp: initPov.scoreCp,
    mateIn: initPov.mateIn,
  });

  let playerMoves = 0;
  for (const san of input.moveSans) {
    const moverBefore = game.turn();
    game.move(san);
    if (moverBefore !== playerSide) continue;

    playerMoves += 1;
    const analysis = await input.analyzer.analyze(game.fen(), thinkMs);
    const pov = scoreToPlayerPov(
      analysis.scoreCp,
      analysis.mateIn,
      game.turn(),
      input.playerColor,
    );
    timeline.push({
      afterPlayerMove: playerMoves,
      playerMoveNumber: playerMoves,
      fen: game.fen(),
      scoreCp: pov.scoreCp,
      mateIn: pov.mateIn,
      san,
    });
  }

  return timeline;
}
