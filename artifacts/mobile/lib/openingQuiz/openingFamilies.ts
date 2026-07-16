import type { OpeningIdentity } from '../openings/OpeningIdentifier.ts';
import quizData from './data/quizLines.json' with { type: 'json' };

export type OpeningQuizLine = { sans: string[]; identity: OpeningIdentity };

type QuizLineEntry = {
  eco: string;
  name: string;
  family: string;
  sans: string[];
  ply: number;
};

type QuizData = {
  families: string[];
  lines: QuizLineEntry[];
};

const data = quizData as QuizData;

export function openingFamilyNames(): string[] {
  return [...data.families];
}

export function openingFamilyCount(): number {
  return data.families.length;
}

export function openingVariationCount(): number {
  return data.lines.length;
}

export function variationsForFamily(family: string): OpeningQuizLine[] {
  return data.lines
    .filter((line) => line.family === family)
    .map((line) => ({
      sans: line.sans,
      identity: { eco: line.eco, name: line.name, ply: line.ply },
    }));
}

export function availableOpeningQuizLines(): OpeningQuizLine[] {
  return data.lines.map((line) => ({
    sans: line.sans,
    identity: { eco: line.eco, name: line.name, ply: line.ply },
  }));
}

export function pickOpeningQuizLine(
  recentNames: string[] = [],
  rng: () => number = Math.random,
): OpeningQuizLine | null {
  const lines = availableOpeningQuizLines();
  const fresh = lines.filter((line) => !recentNames.includes(line.identity.name));
  const pool = fresh.length ? fresh : lines;
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

export function pickRandomVariation(
  rng: () => number = Math.random,
): { family: string; line: OpeningQuizLine } | null {
  const families = openingFamilyNames();
  if (!families.length) return null;
  const family = families[Math.floor(rng() * families.length)];
  const vars = variationsForFamily(family);
  if (!vars.length) return null;
  return { family, line: vars[Math.floor(rng() * vars.length)] };
}
