/**
 * White XOR Black for opening folders. Legacy snapshots may omit `side`;
 * those folders stay in the library until the user classifies them.
 */
import { tMsg } from '../i18n/tMsg.ts';
import type { RepertoireSide } from './storage/types.ts';

export function hasAssignedRepertoireSide(
  side: RepertoireSide | undefined | null,
): side is RepertoireSide {
  return side === 'white' || side === 'black';
}

export function requireRepertoireSide(
  side: RepertoireSide | undefined | null,
): RepertoireSide {
  if (hasAssignedRepertoireSide(side)) return side;
  throw new Error(tMsg('openings.sideRequired'));
}
