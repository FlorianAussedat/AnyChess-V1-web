/**
 * Stable position IDs — never use array indices.
 */
import { createHash } from 'node:crypto';

export function lichessPositionId(puzzleId: string): string {
  const hash = createHash('sha256').update(puzzleId.trim()).digest('hex').slice(0, 8).toUpperCase();
  return `ET-LP-${hash}`;
}

export function manualPositionId(initialFen: string, playerColor: string): string {
  const hash = createHash('sha256')
    .update(`${initialFen}|${playerColor}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `ET-MANUAL-${hash}`;
}

/** Legacy runtime IDs that must never reappear. */
export const FORBIDDEN_LEGACY_IDS = [
  'DD-001', 'DD-002', 'DD-003', 'DD-005', 'DD-006', 'DD-007', 'DD-011', 'DD-013',
  'DD-014', 'DD-018', 'DD-020', 'DD-022', 'DD-023', 'DD-046', 'DD-061', 'DD-062',
  'DD-085', 'DD-087', 'DD-098', 'DD-103', 'DD-126', 'DD-136', 'DD-153', 'DD-163',
  'DD-170', 'DD-180', 'DD-214', 'DD-695', 'DD-705', 'DD-708', 'DD-715', 'DD-732',
  'DD-747', 'DD-809', 'LICHESS-',
] as const;

export function isForbiddenLegacyId(id: string): boolean {
  if (id.startsWith('DD-')) return true;
  if (id.startsWith('FIXTURE-')) return true;
  return false;
}
