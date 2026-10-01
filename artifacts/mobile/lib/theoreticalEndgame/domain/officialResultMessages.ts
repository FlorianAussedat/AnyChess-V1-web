/**
 * Official regulatory result messages for « Finales théoriques » (session layer).
 */
import type {
  AttemptOutcome,
  OfficialEndReason,
  PlayerColor,
  TheoreticalObjective,
} from './types.ts';
import { tMsg } from '../../i18n/tMsg.ts';
import type { MessageKey } from '../../i18n/messages.ts';

const DRAW_KEYS: Record<Exclude<OfficialEndReason, 'checkmate'>, MessageKey> = {
  stalemate: 'endgame.drawStalemate',
  threefold: 'endgame.drawThreefold',
  insufficient: 'endgame.drawInsufficient',
  fifty: 'endgame.drawFifty',
  'position-defended': 'endgame.drawDefended',
};

export type TheoreticalOfficialContext = {
  outcome: AttemptOutcome;
  playerColor: PlayerColor;
  objective: TheoreticalObjective;
  officialEndReason?: OfficialEndReason;
  checkmateWinner?: 'w' | 'b';
};

export function theoreticalOfficialResultKey(
  ctx: TheoreticalOfficialContext,
): MessageKey | null {
  if (ctx.checkmateWinner) {
    const playerSide = ctx.playerColor === 'white' ? 'w' : 'b';
    return ctx.checkmateWinner === playerSide
      ? 'endgame.checkmateWin'
      : 'endgame.checkmateLoss';
  }

  if (ctx.officialEndReason && ctx.officialEndReason !== 'checkmate') {
    return DRAW_KEYS[ctx.officialEndReason] ?? 'endgame.drawGeneric';
  }

  if (ctx.outcome === 'success') {
    if (ctx.objective === 'WIN') {
      return ctx.officialEndReason === 'checkmate'
        ? 'endgame.checkmateWin'
        : 'endgame.positionWon';
    }
    return 'endgame.drawAchieved';
  }

  return null;
}

export function theoreticalOfficialResultMessage(
  ctx: TheoreticalOfficialContext,
): string | null {
  const key = theoreticalOfficialResultKey(ctx);
  return key ? tMsg(key) : null;
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
