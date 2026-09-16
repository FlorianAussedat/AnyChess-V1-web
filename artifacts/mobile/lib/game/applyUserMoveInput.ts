import type { Chess, Move } from 'chess.js';
import { normalizeTranscript, parseChessVoice } from '../voice/index.ts';
import type { VoiceMode } from '../voice/index.ts';
import type { ChessNotation } from '../preferences/types.ts';
import { looksLikeChessMove } from './looksLikeChessMove.ts';
import type { MoveInputSource } from '../moveInput/canonicalMove.ts';

export type ApplyUserMoveInputResult =
  | { kind: 'command'; command: 'repeat' | 'summarize' | 'undo' }
  | { kind: 'ignored-busy' }
  | { kind: 'unrecognized'; emitError: boolean; heardText: string }
  | { kind: 'ambiguous'; heardText: string }
  | { kind: 'illegal'; heardText: string }
  | { kind: 'played'; played: Move; beforeFen: string; heardText: string };

/**
 * Shared voice/text move application for Classic + Openings.
 * Does not announce or trigger the opponent — callers handle that.
 */
export function applyUserMoveInput(opts: {
  raw: string;
  game: Chess;
  mode: VoiceMode;
  waitingForUser: boolean;
  isOpponentThinking: boolean;
  source?: MoveInputSource;
  /** When omitted, parseChessVoice reads PreferencesStore.chessNotation. */
  chessNotation?: ChessNotation;
}): ApplyUserMoveInputResult {
  const { raw, game, mode, waitingForUser, isOpponentThinking, chessNotation } =
    opts;
  const input = normalizeTranscript(raw);
  const parsed = parseChessVoice(raw, game, { mode, chessNotation });

  if (parsed.type === 'command') {
    if (
      parsed.command === 'repeat' ||
      parsed.command === 'summarize' ||
      parsed.command === 'undo'
    ) {
      return { kind: 'command', command: parsed.command };
    }
    return { kind: 'ignored-busy' };
  }

  if (!waitingForUser || isOpponentThinking || game.isGameOver()) {
    return { kind: 'ignored-busy' };
  }

  const heardText = raw ? `« ${raw} »` : '';

  if (parsed.type === 'unrecognized') {
    return {
      kind: 'unrecognized',
      emitError: looksLikeChessMove(input),
      heardText,
    };
  }

  if (parsed.type === 'ambiguous') {
    return { kind: 'ambiguous', heardText };
  }

  if (parsed.type === 'illegal') {
    return { kind: 'illegal', heardText };
  }

  const beforeFen = game.fen();
  try {
    const played = game.move({
      from: parsed.move.from,
      to: parsed.move.to,
      promotion: parsed.move.promotion ?? 'q',
    }) as Move;
    return { kind: 'played', played, beforeFen, heardText };
  } catch {
    return { kind: 'illegal', heardText };
  }
}
