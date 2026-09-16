/**
 * Catalog of real persisted record categories (no storage I/O).
 * Labels are MessageKeys — translate at display with useTranslation / tMsg.
 */
import type { MessageKey } from '../i18n/messages.ts';

export type RecordsCategoryId =
  | 'tactics'
  | 'move-naming'
  | 'play-move'
  | 'memorisation'
  | 'opening-quiz';

export interface RecordsCategoryMeta {
  id: RecordsCategoryId;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  /** Deep-link to the historical per-mode records screen when useful. */
  legacyRoute?: string;
}

/** Catalog of record types that actually exist in storage today. */
export const RECORDS_CATEGORIES: RecordsCategoryMeta[] = [
  {
    id: 'tactics',
    labelKey: 'records.cat.tactics',
    descriptionKey: 'records.cat.tacticsDesc',
    legacyRoute: '/puzzles/records',
  },
  {
    id: 'move-naming',
    labelKey: 'records.cat.naming',
    descriptionKey: 'records.cat.namingDesc',
    legacyRoute: '/visualisation/records',
  },
  {
    id: 'play-move',
    labelKey: 'records.cat.play',
    descriptionKey: 'records.cat.playDesc',
    legacyRoute: '/visualisation/records',
  },
  {
    id: 'memorisation',
    labelKey: 'records.cat.blind',
    descriptionKey: 'records.cat.blindDesc',
    legacyRoute: '/blind',
  },
  {
    id: 'opening-quiz',
    labelKey: 'records.cat.openingQuiz',
    descriptionKey: 'records.cat.openingQuizDesc',
    legacyRoute: '/quiz-ouverture/quelle',
  },
];

/** Pure helper for tests — which categories the hub should expose. */
export function listRecordsCategoryIds(): RecordsCategoryId[] {
  return RECORDS_CATEGORIES.map((c) => c.id);
}
