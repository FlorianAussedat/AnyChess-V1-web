/**
 * Official regulatory result messages (session layer — not UI).
 * Domain returns localizable keys; `officialResultMessage` renders with tMsg.
 */
import type { OfficialDrawReason } from './types.ts';
import type { AttemptOutcome } from './types.ts';
import { tMsg } from '../../i18n/tMsg.ts';
import type { MessageKey, MessageParams } from '../../i18n/messages.ts';

export type OfficialResultContext = {
  outcome: AttemptOutcome;
  /** Defender / trained player color. */
  playerColor: 'white' | 'black';
  officialDrawReason?: OfficialDrawReason;
  /** Regulatory checkmate winner side ('w' | 'b'). */
  checkmateWinner?: 'w' | 'b';
};

export type LocalizableCopy = {
  key: MessageKey;
  params?: MessageParams;
};

const DRAW_KEYS: Record<OfficialDrawReason, MessageKey> = {
  stalemate: 'endgame.drawStalemate',
  threefold: 'endgame.drawThreefold',
  insufficient: 'endgame.drawInsufficient',
  fifty: 'endgame.drawFifty',
  'position-defended': 'endgame.drawDefended',
};

export function officialResultCopy(ctx: OfficialResultContext): LocalizableCopy | null {
  if (ctx.outcome === 'win-official-draw' && ctx.officialDrawReason) {
    return { key: DRAW_KEYS[ctx.officialDrawReason] ?? 'endgame.drawGeneric' };
  }

  if (ctx.outcome === 'win-30-moves') {
    return { key: 'endgame.defendedThirty' };
  }

  if (ctx.checkmateWinner) {
    const playerSide = ctx.playerColor === 'white' ? 'w' : 'b';
    if (ctx.checkmateWinner === playerSide) {
      return { key: 'endgame.checkmateWin' };
    }
    return { key: 'endgame.checkmateLoss' };
  }

  if (ctx.outcome === 'loss') {
    return null; // loss feedback handled separately (threshold / alternatives)
  }

  return null;
}

export function officialResultMessage(ctx: OfficialResultContext): string | null {
  const copy = officialResultCopy(ctx);
  return copy ? tMsg(copy.key, copy.params) : null;
}

/** Whether the position is still legally playable (finish-game button eligible). */
export function isLegallyPlayableAfterScoreLock(
  gameOver: boolean,
  outcome: AttemptOutcome,
): boolean {
  if (!gameOver) return true;
  // Official terminal results — no finish-game
  if (outcome === 'win-official-draw') return false;
  if (outcome === 'loss') {
    // Loss by threshold may still be playable if game not over
    return false;
  }
  return false;
}

export function canOfferFinishGame(input: {
  scoreLocked: boolean;
  gameOver: boolean;
  outcome: AttemptOutcome;
  phase: string;
}): boolean {
  if (!input.scoreLocked || input.phase === 'off-score') return false;
  if (input.outcome === 'win-30-moves' && !input.gameOver) return true;
  if (input.outcome === 'loss' && !input.gameOver) return true;
  return false;
}
