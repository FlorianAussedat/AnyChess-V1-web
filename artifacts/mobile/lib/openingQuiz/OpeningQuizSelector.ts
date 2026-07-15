import { identifyOpeningFromSans, type OpeningIdentity } from '../openings/OpeningIdentifier.ts';

export type OpeningQuizLine = { sans: string[]; identity: OpeningIdentity };

// Lines are deliberately compact: the dataset is still the authority for the
// identifiable final position, while a line is needed to present a quiz.
const candidates = [
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
  ['e4', 'c5'],
  ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'g6'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
  ['e4', 'e6', 'd4', 'd5'],
  ['d4', 'd5', 'c4', 'e6'],
];

export function availableOpeningQuizLines(): OpeningQuizLine[] {
  return candidates.flatMap((sans) => {
    const identity = identifyOpeningFromSans(sans);
    return identity ? [{ sans, identity }] : [];
  });
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
