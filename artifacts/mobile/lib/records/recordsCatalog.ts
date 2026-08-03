/**
 * Catalog of real persisted record categories (no storage I/O).
 */
export type RecordsCategoryId = 'tactics' | 'move-naming';

export interface RecordsCategoryMeta {
  id: RecordsCategoryId;
  label: string;
  description: string;
  /** Deep-link to the historical per-mode records screen when useful. */
  legacyRoute?: string;
}

/** Catalog of record types that actually exist in storage today. */
export const RECORDS_CATEGORIES: RecordsCategoryMeta[] = [
  {
    id: 'tactics',
    label: 'Tactiques',
    description: 'Meilleures séries de problèmes par bande de difficulté',
    legacyRoute: '/puzzles/records',
  },
  {
    id: 'move-naming',
    label: 'Nommer le coup',
    description: 'Meilleurs scores sur 60 secondes (Visualisation)',
    legacyRoute: '/visualisation/records',
  },
];

/** Pure helper for tests — which categories the hub should expose. */
export function listRecordsCategoryIds(): RecordsCategoryId[] {
  return RECORDS_CATEGORIES.map((c) => c.id);
}
