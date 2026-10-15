import type { MessageKey } from '../i18n/messages.ts';

/** Bundled mascots already shipped in assets/brand/mascots. Ids stay stable. */
export const ANYCHESS_MASCOTS = [
  { id: 'classic-knight-soundwave', labelKey: 'modes.classic.title' },
  { id: 'openings-knight-reading', labelKey: 'modes.openings.title' },
  { id: 'blind-knight-blindfold', labelKey: 'modes.blind.title' },
  { id: 'tactics-knight-calculator', labelKey: 'modes.puzzles.title' },
  { id: 'visualisation-knight-binoculars', labelKey: 'modes.visualisation.title' },
  { id: 'quiz-knight-detective', labelKey: 'modes.quiz-ouverture.title' },
  { id: 'player-knight-dj', labelKey: 'modes.parties.title' },
  { id: 'difficulty-debutant', labelKey: 'difficulty.debutant' },
  { id: 'difficulty-confirme', labelKey: 'difficulty.confirme' },
  { id: 'difficulty-expert', labelKey: 'difficulty.expert' },
  { id: 'difficulty-gm', labelKey: 'difficulty.grandMaitre' },
] as const satisfies ReadonlyArray<{ id: string; labelKey: MessageKey }>;

export type MascotId = (typeof ANYCHESS_MASCOTS)[number]['id'];

export function isMascotId(value: unknown): value is MascotId {
  return typeof value === 'string' && ANYCHESS_MASCOTS.some((row) => row.id === value);
}

export function listMascotIds(): MascotId[] {
  return ANYCHESS_MASCOTS.map((row) => row.id);
}
