/**
 * Official regulatory result messages (session layer — not UI).
 */
import type { OfficialDrawReason } from './types.ts';
import type { AttemptOutcome } from './types.ts';

export type OfficialResultContext = {
  outcome: AttemptOutcome;
  /** Defender / trained player color. */
  playerColor: 'white' | 'black';
  officialDrawReason?: OfficialDrawReason;
  /** Regulatory checkmate winner side ('w' | 'b'). */
  checkmateWinner?: 'w' | 'b';
};

const DRAW_MESSAGES: Record<OfficialDrawReason, string> = {
  stalemate: 'Nulle obtenue par pat. Bien joué !',
  threefold: 'Nulle obtenue par répétition. Bien joué !',
  insufficient: 'Nulle par matériel insuffisant. Bien joué !',
  fifty: 'Nulle obtenue par la règle des 50 coups. Bien joué !',
};

export function officialResultMessage(ctx: OfficialResultContext): string | null {
  if (ctx.outcome === 'win-official-draw' && ctx.officialDrawReason) {
    return DRAW_MESSAGES[ctx.officialDrawReason] ?? 'Nulle obtenue. Bien joué !';
  }

  if (ctx.outcome === 'win-30-moves') {
    return 'Finale défendue ! Tu as résisté 30 coups.';
  }

  if (ctx.checkmateWinner) {
    const playerSide = ctx.playerColor === 'white' ? 'w' : 'b';
    if (ctx.checkmateWinner === playerSide) {
      return 'Échec et mat. Partie gagnée !';
    }
    return 'Échec et mat. Partie perdue.';
  }

  if (ctx.outcome === 'loss') {
    return null; // loss feedback handled separately (threshold / alternatives)
  }

  return null;
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
