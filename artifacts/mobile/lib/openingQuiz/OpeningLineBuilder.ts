import { identifyOpeningFromSans, type OpeningIdentity } from '../openings/OpeningIdentifier.ts';
import { availableOpeningQuizLines } from './OpeningQuizSelector.ts';

export type OpeningTarget = { identity: OpeningIdentity; sans: string[] };

/** Builds short reference lines whose final position is confirmed by the ECO index. */
export function openingTargets(): OpeningTarget[] {
  return availableOpeningQuizLines().map(({ identity, sans }) => ({ identity, sans }));
}

export function findOpeningTarget(name: string): OpeningTarget | null {
  return openingTargets().find((target) => target.identity.name === name) ?? null;
}

export function lineStopsAtDefiningPosition(sans: string[]): boolean {
  const hit = identifyOpeningFromSans(sans);
  return hit?.ply === sans.length;
}
