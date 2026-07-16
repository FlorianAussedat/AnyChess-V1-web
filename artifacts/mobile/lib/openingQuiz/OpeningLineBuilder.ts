import { identifyOpeningFromSans, type OpeningIdentity } from '../openings/OpeningIdentifier.ts';
import {
  availableOpeningQuizLines,
  variationsForFamily,
  type OpeningQuizLine,
} from './OpeningQuizSelector.ts';

export type OpeningTarget = { identity: OpeningIdentity; sans: string[] };

function toTarget(line: OpeningQuizLine): OpeningTarget {
  return { identity: line.identity, sans: line.sans };
}

/** Builds short reference lines whose final position is confirmed by the ECO index. */
export function openingTargets(): OpeningTarget[] {
  return availableOpeningQuizLines().map(toTarget);
}

export function openingTargetsForFamily(family: string): OpeningTarget[] {
  return variationsForFamily(family).map(toTarget);
}

export function findOpeningTarget(name: string): OpeningTarget | null {
  return openingTargets().find((target) => target.identity.name === name) ?? null;
}

export function lineStopsAtDefiningPosition(sans: string[]): boolean {
  const hit = identifyOpeningFromSans(sans);
  return hit?.ply === sans.length;
}
