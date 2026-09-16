/**
 * Official regulatory result messages for « Finales théoriques » (session layer).
 */
import type {
  AttemptOutcome,
  OfficialEndReason,
  PlayerColor,
  TheoreticalObjective,
} from './types.ts';

const DRAW_MESSAGES: Record<Exclude<OfficialEndReason, 'checkmate'>, string> = {
  stalemate: 'Nulle obtenue par pat. Bien joué !',
  threefold: 'Nulle obtenue par répétition. Bien joué !',
  insufficient: 'Nulle par matériel insuffisant. Bien joué !',
  fifty: 'Nulle obtenue par la règle des 50 coups. Bien joué !',
  'position-defended': 'Nulle — position défendue',
};

export type TheoreticalOfficialContext = {
  outcome: AttemptOutcome;
  playerColor: PlayerColor;
  objective: TheoreticalObjective;
  officialEndReason?: OfficialEndReason;
  checkmateWinner?: 'w' | 'b';
};

export function theoreticalOfficialResultMessage(
  ctx: TheoreticalOfficialContext,
): string | null {
  if (ctx.checkmateWinner) {
    const playerSide = ctx.playerColor === 'white' ? 'w' : 'b';
    if (ctx.checkmateWinner === playerSide) {
      return 'Échec et mat. Partie gagnée !';
    }
    return 'Échec et mat. Partie perdue.';
  }

  if (ctx.officialEndReason && ctx.officialEndReason !== 'checkmate') {
    return DRAW_MESSAGES[ctx.officialEndReason] ?? 'Nulle obtenue. Bien joué !';
  }

  if (ctx.outcome === 'success') {
    if (ctx.objective === 'WIN') {
      return ctx.officialEndReason === 'checkmate'
        ? 'Échec et mat. Partie gagnée !'
        : 'Position gagnée !';
    }
    return 'Nulle obtenue !';
  }

  return null;
}

/** Whether « Finir la partie » is eligible after a scored attempt. */
export function canOfferTheoreticalFinishGame(input: {
  scoreLocked: boolean;
  gameOver: boolean;
  finishGameActive: boolean;
  phase: string;
}): boolean {
  if (!input.scoreLocked || input.finishGameActive) return false;
  if (input.gameOver) return false;
  return input.phase === 'success' || input.phase === 'theoretical-loss';
}
