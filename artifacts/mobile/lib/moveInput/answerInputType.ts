/**
 * Semantic input kind for answer fields across the app.
 * Screens should choose based on the expected answer shape, not the screen name.
 */
export type AnswerInputType = 'chess-move' | 'free-text';

export function isChessMoveInput(type: AnswerInputType): boolean {
  return type === 'chess-move';
}
