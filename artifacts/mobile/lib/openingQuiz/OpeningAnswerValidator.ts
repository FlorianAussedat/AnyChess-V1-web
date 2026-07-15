import { openingAliasRepository } from './OpeningAliasRepository.ts';
import { normalizeOpeningName } from './OpeningNameNormalizer.ts';

export type OpeningAnswerVerdict = { correct: boolean; acceptedAs: 'exact' | 'family' | null };

/** Accepts an exact canonical/French alias; a family is accepted for a named variation. */
export function validateOpeningAnswer(answer: string, canonicalName: string): OpeningAnswerVerdict {
  const actual = normalizeOpeningName(answer);
  if (!actual) return { correct: false, acceptedAs: null };
  const accepted = openingAliasRepository.aliasesFor(canonicalName).map(normalizeOpeningName);
  if (accepted.includes(actual)) return { correct: true, acceptedAs: 'exact' };
  const family = canonicalName.split(':')[0].trim();
  const familyAliases = openingAliasRepository.aliasesFor(family).map(normalizeOpeningName);
  if (canonicalName.includes(':') && familyAliases.includes(actual)) {
    return { correct: true, acceptedAs: 'family' };
  }
  return { correct: false, acceptedAs: null };
}
