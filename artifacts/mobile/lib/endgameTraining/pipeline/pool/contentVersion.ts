/**
 * Deterministic contentVersion from active pool entries.
 */
import { createHash } from 'node:crypto';
import type { EndgameTrainingPosition } from '../../domain/types.ts';

export function computeContentVersion(
  positions: readonly Pick<
    EndgameTrainingPosition,
    'id' | 'fen' | 'defender'
  >[],
): string {
  const sorted = [...positions].sort((a, b) => a.id.localeCompare(b.id));
  const payload = sorted.map((p) => [p.id, p.fen, p.defender].join('|'));
  return createHash('sha256').update(payload.join('\n')).digest('hex').slice(0, 16);
}
