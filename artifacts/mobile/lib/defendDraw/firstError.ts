/**
 * Post-game analysis: find the first decisive error.
 *
 * After a failed endgame, replays the player's moves and uses Stockfish
 * to detect the first move that changed the position evaluation significantly.
 *
 * For WIN objective: first move that turns a win into a draw/loss.
 * For DRAW objective: first move that turns a draw into a loss.
 */
import { Chess } from 'chess.js';
import type { DefenseAnalyzer, DefenseAnalysis } from './defenseTypes.ts';
import type { EndgameObjective } from './positions.ts';

export type FirstErrorResult = {
  found: boolean;
  moveIndex: number | null;
  moveSan: string | null;
  bestMoveSan: string | null;
  fenBeforeError: string | null;
  evalBefore: { scoreCp: number; wdl: DefenseAnalysis['wdl'] } | null;
  evalAfter: { scoreCp: number; wdl: DefenseAnalysis['wdl'] } | null;
  message: string;
};

const ANALYSIS_TIME_MS = 1500;

function isWinning(analysis: DefenseAnalysis, playerColor: 'w' | 'b', stm: 'w' | 'b'): boolean {
  const playerPerspectiveCp = stm === playerColor ? analysis.scoreCp : -analysis.scoreCp;
  if (analysis.wdl) {
    const playerWin = stm === playerColor ? analysis.wdl.win : analysis.wdl.loss;
    return playerWin >= 500;
  }
  return playerPerspectiveCp >= 150;
}

function isDrawish(analysis: DefenseAnalysis, playerColor: 'w' | 'b', stm: 'w' | 'b'): boolean {
  if (analysis.wdl) {
    return analysis.wdl.draw >= 300 && !isLosing(analysis, playerColor, stm);
  }
  const playerPerspectiveCp = stm === playerColor ? analysis.scoreCp : -analysis.scoreCp;
  return Math.abs(playerPerspectiveCp) < 150;
}

function isLosing(analysis: DefenseAnalysis, playerColor: 'w' | 'b', stm: 'w' | 'b'): boolean {
  const playerPerspectiveCp = stm === playerColor ? analysis.scoreCp : -analysis.scoreCp;
  if (analysis.wdl) {
    const playerLoss = stm === playerColor ? analysis.wdl.loss : analysis.wdl.win;
    return playerLoss >= 500;
  }
  return playerPerspectiveCp <= -200;
}

export async function findFirstError(
  analyzer: DefenseAnalyzer,
  startFen: string,
  moveHistory: string[],
  playerColor: 'w' | 'b',
  objective: EndgameObjective,
): Promise<FirstErrorResult> {
  if (moveHistory.length === 0) {
    return { found: false, moveIndex: null, moveSan: null, bestMoveSan: null, fenBeforeError: null, evalBefore: null, evalAfter: null, message: 'Aucun coup joué.' };
  }

  const game = new Chess(startFen);

  for (let i = 0; i < moveHistory.length; i++) {
    const fen = game.fen();
    const isPlayerTurn = game.turn() === playerColor;

    if (isPlayerTurn) {
      let analysisBefore: DefenseAnalysis;
      try {
        analysisBefore = await analyzer.analyze(fen, ANALYSIS_TIME_MS);
      } catch {
        try { game.move(moveHistory[i]!); } catch { break; }
        continue;
      }

      const stmBefore = game.turn();

      try {
        game.move(moveHistory[i]!);
      } catch {
        break;
      }

      let analysisAfter: DefenseAnalysis;
      try {
        analysisAfter = await analyzer.analyze(game.fen(), ANALYSIS_TIME_MS);
      } catch {
        continue;
      }

      const stmAfter = game.turn();
      const errorDetected = detectError(
        analysisBefore, stmBefore, analysisAfter, stmAfter,
        playerColor, objective,
      );

      if (errorDetected) {
        const bestMoveSan = analysisBefore.bestMove
          ? tryConvertToSan(fen, analysisBefore.bestMove)
          : null;

        return {
          found: true,
          moveIndex: i,
          moveSan: moveHistory[i]!,
          bestMoveSan,
          fenBeforeError: fen,
          evalBefore: { scoreCp: analysisBefore.scoreCp, wdl: analysisBefore.wdl },
          evalAfter: { scoreCp: analysisAfter.scoreCp, wdl: analysisAfter.wdl },
          message: 'Première erreur probable selon Stockfish',
        };
      }
    } else {
      try {
        game.move(moveHistory[i]!);
      } catch {
        break;
      }
    }
  }

  return {
    found: false,
    moveIndex: null,
    moveSan: null,
    bestMoveSan: null,
    fenBeforeError: null,
    evalBefore: null,
    evalAfter: null,
    message: 'Aucune erreur décisive clairement identifiée.',
  };
}

function detectError(
  before: DefenseAnalysis, stmBefore: 'w' | 'b',
  after: DefenseAnalysis, stmAfter: 'w' | 'b',
  playerColor: 'w' | 'b',
  objective: EndgameObjective,
): boolean {
  if (objective === 'WIN') {
    return isWinning(before, playerColor, stmBefore) && !isWinning(after, playerColor, stmAfter);
  }
  const wasHoldable = isDrawish(before, playerColor, stmBefore) || isWinning(before, playerColor, stmBefore);
  return wasHoldable && isLosing(after, playerColor, stmAfter);
}

function tryConvertToSan(
  fen: string,
  bestMove: { from: string; to: string; promotion?: string | null },
): string | null {
  try {
    const g = new Chess(fen);
    const m = g.move({
      from: bestMove.from,
      to: bestMove.to,
      promotion: (bestMove.promotion ?? undefined) as 'q' | 'r' | 'b' | 'n' | undefined,
    });
    return m?.san ?? null;
  } catch {
    return null;
  }
}
