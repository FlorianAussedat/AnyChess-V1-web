/**
 * Resolve FR/EN copy for a culture quiz question without mutating the source.
 */
import type { ChessCultureQuestion } from './types.ts';

export type AppQuizLanguage = 'fr' | 'en';

export function localizeChessCultureQuestion(
  question: ChessCultureQuestion,
  language: AppQuizLanguage,
): ChessCultureQuestion {
  if (language !== 'en' || !question.i18nEn) {
    return question;
  }
  return {
    ...question,
    question: question.i18nEn.question,
    answers: question.i18nEn.answers,
    explanation: question.i18nEn.explanation,
  };
}

export function localizeChessCultureQuestions(
  questions: readonly ChessCultureQuestion[],
  language: AppQuizLanguage,
): ChessCultureQuestion[] {
  return questions.map((q) => localizeChessCultureQuestion(q, language));
}
