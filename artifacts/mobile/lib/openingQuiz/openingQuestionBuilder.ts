/**
 * Build Quelle-ouverture questions by difficulty with smart distractors.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import {
  availableOpeningQuizLines,
  openingFamilyNames,
  variationsForFamily,
  type OpeningQuizLine,
} from './openingFamilies.ts';

export type OpeningQuizAnswerMode = 'mcq' | 'free-text';

export type OpeningQuizPromptKind = 'family' | 'variation' | 'free-text';

export type BuiltOpeningQuestion = {
  line: OpeningQuizLine;
  family: string;
  difficulty: AnyChessDifficultyId;
  answerMode: OpeningQuizAnswerMode;
  /** Step-1 MCQ options (families or full names). Empty for free-text. */
  options: string[];
  /** Confirmé step-2 variation options. */
  step2Options: string[] | null;
  correctFamily: string;
  correctName: string;
};

export function familyOfOpeningName(name: string): string {
  const i = name.indexOf(':');
  return i >= 0 ? name.slice(0, i).trim() : name.trim();
}

export function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

function shuffleCopy<T>(items: readonly T[], rng: () => number): T[] {
  return shuffleInPlace([...items], rng);
}

function pickDistinct(
  pool: readonly string[],
  count: number,
  exclude: Set<string>,
  rng: () => number,
): string[] {
  const candidates = shuffleCopy(
    pool.filter((x) => x.length > 0 && !exclude.has(x)),
    rng,
  );
  return candidates.slice(0, Math.max(0, count));
}

function ecoLetter(line: OpeningQuizLine): string {
  return (line.identity.eco?.[0] ?? '').toUpperCase();
}

/** Prefer families that share the same ECO letter, then any other family. */
export function buildFamilyOptions(
  correctFamily: string,
  count: number,
  rng: () => number,
  hintEco?: string,
): string[] {
  const families = openingFamilyNames();
  const exclude = new Set([correctFamily]);
  const sameEco =
    hintEco != null && hintEco.length > 0
      ? families.filter((f) =>
          variationsForFamily(f).some(
            (v) => (v.identity.eco?.[0] ?? '').toUpperCase() === hintEco,
          ),
        )
      : [];
  const preferred = pickDistinct(sameEco, count - 1, exclude, rng);
  const need = count - 1 - preferred.length;
  const rest =
    need > 0
      ? pickDistinct(families, need, new Set([...exclude, ...preferred]), rng)
      : [];
  return shuffleCopy([correctFamily, ...preferred, ...rest], rng);
}

/**
 * Prefer other variations in the same family, then same ECO letter,
 * then any other line name.
 */
export function buildVariationOptions(
  line: OpeningQuizLine,
  count: number,
  rng: () => number,
): string[] {
  const correct = line.identity.name;
  const family = familyOfOpeningName(correct);
  const exclude = new Set([correct]);
  const chosen: string[] = [];

  const siblings = variationsForFamily(family)
    .map((v) => v.identity.name)
    .filter((n) => n !== correct);
  chosen.push(...pickDistinct(siblings, count - 1, exclude, rng));

  let need = count - 1 - chosen.length;
  if (need > 0) {
    const letter = ecoLetter(line);
    const related = availableOpeningQuizLines()
      .filter(
        (l) =>
          l.identity.name !== correct &&
          familyOfOpeningName(l.identity.name) !== family &&
          ecoLetter(l) === letter,
      )
      .map((l) => l.identity.name);
    chosen.push(
      ...pickDistinct(related, need, new Set([...exclude, ...chosen]), rng),
    );
    need = count - 1 - chosen.length;
  }

  if (need > 0) {
    const all = availableOpeningQuizLines().map((l) => l.identity.name);
    chosen.push(...pickDistinct(all, need, new Set([...exclude, ...chosen]), rng));
  }

  return shuffleCopy([correct, ...chosen], rng);
}

/** Lines eligible for a difficulty (same richness rules as pickLineForDifficulty). */
export function eligibleLinesForDifficulty(
  difficulty: AnyChessDifficultyId,
  recentNames: string[] = [],
): OpeningQuizLine[] {
  let lines = availableOpeningQuizLines();
  const fresh = lines.filter((l) => !recentNames.includes(l.identity.name));
  lines = fresh.length > 0 ? fresh : lines;

  if (difficulty === 'expert' || difficulty === 'confirme') {
    const minVars = difficulty === 'expert' ? 4 : 2;
    const rich = lines.filter(
      (l) =>
        variationsForFamily(familyOfOpeningName(l.identity.name)).length >= minVars,
    );
    if (rich.length > 0) lines = rich;
  }

  return lines;
}

export function pickLineForDifficulty(
  difficulty: AnyChessDifficultyId,
  recentNames: string[],
  rng: () => number,
): OpeningQuizLine | null {
  const lines = eligibleLinesForDifficulty(difficulty, recentNames);
  if (lines.length === 0) return null;
  return lines[Math.floor(rng() * lines.length)] ?? null;
}

/**
 * Pick up to `count` distinct lines for a level (by identity.name).
 * Does not silently repeat — returns fewer when the pool is too small.
 */
export function pickDistinctLinesForDifficulty(
  difficulty: AnyChessDifficultyId,
  count: number,
  rng: () => number = Math.random,
): OpeningQuizLine[] {
  const pool = shuffleCopy(eligibleLinesForDifficulty(difficulty, []), rng);
  const seen = new Set<string>();
  const picked: OpeningQuizLine[] = [];
  for (const line of pool) {
    const name = line.identity.name;
    if (seen.has(name)) continue;
    seen.add(name);
    picked.push(line);
    if (picked.length >= count) break;
  }
  return picked;
}

export function buildOpeningQuestionFromLine(
  line: OpeningQuizLine,
  difficulty: AnyChessDifficultyId,
  rng: () => number = Math.random,
): BuiltOpeningQuestion {
  const family = familyOfOpeningName(line.identity.name);
  const letter = ecoLetter(line);
  const correctName = line.identity.name;

  if (difficulty === 'debutant') {
    return {
      line,
      family,
      difficulty,
      answerMode: 'mcq',
      options: buildFamilyOptions(family, 4, rng, letter),
      step2Options: null,
      correctFamily: family,
      correctName,
    };
  }

  if (difficulty === 'confirme') {
    return {
      line,
      family,
      difficulty,
      answerMode: 'mcq',
      options: buildFamilyOptions(family, 4, rng, letter),
      step2Options: buildVariationOptions(line, 4, rng),
      correctFamily: family,
      correctName,
    };
  }

  if (difficulty === 'expert') {
    return {
      line,
      family,
      difficulty,
      answerMode: 'mcq',
      options: buildVariationOptions(line, 8, rng),
      step2Options: null,
      correctFamily: family,
      correctName,
    };
  }

  return {
    line,
    family,
    difficulty,
    answerMode: 'free-text',
    options: [],
    step2Options: null,
    correctFamily: family,
    correctName,
  };
}

export function buildOpeningQuestion(
  difficulty: AnyChessDifficultyId,
  recentNames: string[] = [],
  rng: () => number = Math.random,
): BuiltOpeningQuestion | null {
  const line = pickLineForDifficulty(difficulty, recentNames, rng);
  if (!line) return null;
  return buildOpeningQuestionFromLine(line, difficulty, rng);
}

export function promptKindForQuestion(
  difficulty: AnyChessDifficultyId,
  step: 1 | 2,
): OpeningQuizPromptKind {
  if (difficulty === 'grandMaitre') return 'free-text';
  if (difficulty === 'debutant') return 'family';
  if (difficulty === 'confirme') return step === 1 ? 'family' : 'variation';
  return 'variation';
}
