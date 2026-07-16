/**
 * Validate spoken/typed answers to mental-position questions.
 */
import { validateOpeningAnswer } from '../openingQuiz/OpeningAnswerValidator.ts';
import type { PositionQuestion } from './PositionQuestionGenerator.ts';
import { normalizeAnswer } from './PositionQuestionGenerator.ts';

export type AnswerVerdict = {
  correct: boolean;
  /** true when the transcript looks empty / garbage — not a chess answer. */
  recognitionFailure: boolean;
};

const NOISE = /^(euh|hm+|uh+|um+|bonjour|hello)$/;

const NUMERIC_KINDS = new Set([
  'capture_count',
  'capture_count_by_color',
  'capture_order_nth',
  'remaining_piece_type_count',
  'piece_count_color',
  'count_developed',
  'piece_move_count',
]);

const SAN_KINDS = new Set([
  'nth_white_move',
  'nth_black_move',
  'last_white_move',
  'last_black_move',
  'last_sequence_move',
]);

const YES_NO_KINDS = new Set([
  'castling_rights',
  'castling_played',
  'castling_side',
  'still_on_board',
  'king_in_check',
]);

export function validatePositionAnswer(
  question: PositionQuestion,
  raw: string,
): AnswerVerdict {
  const norm = normalizeAnswer(raw);
  if (!norm || NOISE.test(norm)) {
    return { correct: false, recognitionFailure: true };
  }

  if (question.kind === 'opening_id') {
    const verdict = validateOpeningAnswer(raw, question.displayAnswer);
    return { correct: verdict.correct, recognitionFailure: false };
  }

  if (NUMERIC_KINDS.has(question.kind)) {
    const digits = norm.match(/\d+/);
    const expected = question.accepted[0];
    if (digits && digits[0] === expected) {
      return { correct: true, recognitionFailure: false };
    }
  }

  if (SAN_KINDS.has(question.kind)) {
    const cleaned = norm.replace(/\s+/g, '');
    for (const accepted of question.accepted) {
      const acc = accepted.replace(/\s+/g, '');
      if (cleaned === acc || cleaned.includes(acc) || acc.includes(cleaned)) {
        return { correct: true, recognitionFailure: false };
      }
    }
  }

  if (YES_NO_KINDS.has(question.kind)) {
    const yes = question.displayAnswer.toLowerCase().startsWith('oui');
    const noWords = ['non', 'no', 'faux', 'false', 'capture', 'captur'];
    const yesWords = ['oui', 'yes', 'vrai', 'true', 'encore', 'toujours'];
    if (yes && yesWords.some((w) => norm.includes(w))) {
      return { correct: true, recognitionFailure: false };
    }
    if (!yes && noWords.some((w) => norm.includes(w))) {
      return { correct: true, recognitionFailure: false };
    }
    if (question.kind === 'still_on_board' && !yes && norm.includes('captur')) {
      return { correct: true, recognitionFailure: false };
    }
  }

  for (const accepted of question.accepted) {
    if (norm === accepted) return { correct: true, recognitionFailure: false };
    if (accepted.length >= 3 && norm.includes(accepted)) {
      return { correct: true, recognitionFailure: false };
    }
    if (norm.length >= 3 && accepted.includes(norm)) {
      return { correct: true, recognitionFailure: false };
    }
  }

  const sq = norm.match(/\b([a-h][1-8])\b/);
  if (sq && (question.kind === 'locate_piece' || question.kind === 'temporal_piece_location')) {
    if (question.accepted.includes(sq[1])) {
      return { correct: true, recognitionFailure: false };
    }
  }

  return { correct: false, recognitionFailure: false };
}
