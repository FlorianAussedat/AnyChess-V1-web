export type { HapticKind } from './haptics.ts';
export { triggerHaptic } from './haptics.ts';

export type { MoveFeedbackKind, MoveFeedbackState } from './moveFeedback.ts';
export {
  CORRECT_FEEDBACK_MS,
  initialMoveFeedbackState,
  reduceMoveFeedback,
} from './moveFeedback.ts';
