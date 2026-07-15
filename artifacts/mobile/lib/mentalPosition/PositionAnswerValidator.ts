/**
 * Validate spoken/typed answers to mental-position questions.
 */
import type { PositionQuestion } from './PositionQuestionGenerator.ts';
import { normalizeAnswer } from './PositionQuestionGenerator.ts';

export type AnswerVerdict = {
  correct: boolean;
  /** true when the transcript looks empty / garbage — not a chess answer. */
  recognitionFailure: boolean;
};

const NOISE = /^(euh|hm+|uh+|um+|bonjour|hello)$/;

export function validatePositionAnswer(
  question: PositionQuestion,
  raw: string,
): AnswerVerdict {
  const norm = normalizeAnswer(raw);
  if (!norm || NOISE.test(norm)) {
    return { correct: false, recognitionFailure: true };
  }

  for (const accepted of question.accepted) {
    if (norm === accepted) return { correct: true, recognitionFailure: false };
    if (accepted.length >= 2 && norm.includes(accepted)) {
      return { correct: true, recognitionFailure: false };
    }
    if (norm.length >= 2 && accepted.includes(norm) && /[a-h][1-8]/.test(norm)) {
      return { correct: true, recognitionFailure: false };
    }
  }

  // Square-only answers for locate questions
  const sq = norm.match(/\b([a-h][1-8])\b/);
  if (sq && question.kind === 'locate_piece') {
    if (question.accepted.includes(sq[1])) {
      return { correct: true, recognitionFailure: false };
    }
  }

  return { correct: false, recognitionFailure: false };
}
