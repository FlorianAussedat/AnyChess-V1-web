/**
 * Resolve FR/EN copy for a culture quiz question without mutating the source.
 */
import type { ChessCultureQuestion } from './types.ts';

export type AppQuizLanguage = 'fr' | 'en';

export function missingChessCultureEnglishIds(
  questions: readonly ChessCultureQuestion[],
): string[] {
  return questions.filter((q) => !q.i18nEn).map((q) => q.id);
}

export function localizeChessCultureQuestion(
  question: ChessCultureQuestion,
  language: AppQuizLanguage,
): ChessCultureQuestion {
  if (language !== 'en') {
    return question;
  }
  if (!question.i18nEn) {
    return {
      ...question,
      question: `[EN unavailable] ${question.question}`,
      explanation: `[EN unavailable] ${question.explanation}`,
    };
  }
  return {
    ...question,
    question: question.i18nEn.question,
    answers: question.i18nEn.answers,
    explanation: question.i18nEn.explanation,
    presentation: question.presentation
      ? {
          ...question.presentation,
          imageAlt: question.i18nEn.imageAlt ?? question.presentation.imageAlt,
          imageCaption: question.i18nEn.imageCaption ?? question.presentation.imageCaption,
        }
      : question.presentation,
  };
}

export function localizeChessCultureQuestions(
  questions: readonly ChessCultureQuestion[],
  language: AppQuizLanguage,
): ChessCultureQuestion[] {
  return questions.map((q) => localizeChessCultureQuestion(q, language));
}
