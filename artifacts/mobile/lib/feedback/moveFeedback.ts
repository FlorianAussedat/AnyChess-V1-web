/**
 * Pure move-feedback state — shared across Jouer / Nommer / puzzles / etc.
 * UI + SFX/haptics stay in the hook; this module is timer-free and testable.
 */

export type MoveFeedbackKind = 'idle' | 'correct' | 'incorrect' | 'invalid';

export type MoveFeedbackState = {
  kind: MoveFeedbackKind;
  /** Monotonic id so React effects can react to repeated same-kind events. */
  eventId: number;
  /** Optional detail (e.g. pedagogical hint). Cleared on idle. */
  message: string | null;
};

export const CORRECT_FEEDBACK_MS = 3000;

export function initialMoveFeedbackState(): MoveFeedbackState {
  return { kind: 'idle', eventId: 0, message: null };
}

export function reduceMoveFeedback(
  prev: MoveFeedbackState,
  action:
    | { type: 'correct'; message?: string }
    | { type: 'incorrect'; message?: string }
    | { type: 'invalid'; message?: string }
    | { type: 'clear' }
    | { type: 'nextAttempt' },
): MoveFeedbackState {
  const nextId = prev.eventId + 1;
  switch (action.type) {
    case 'correct':
      return {
        kind: 'correct',
        eventId: nextId,
        message: action.message ?? null,
      };
    case 'incorrect':
      return {
        kind: 'incorrect',
        eventId: nextId,
        message: action.message ?? null,
      };
    case 'invalid':
      return {
        kind: 'invalid',
        eventId: nextId,
        message: action.message ?? null,
      };
    case 'clear':
    case 'nextAttempt':
      return { kind: 'idle', eventId: nextId, message: null };
  }
}
