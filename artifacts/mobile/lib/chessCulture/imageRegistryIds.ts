/**
 * Registered Culture générale imageIds (no asset requires).
 * Safe to import from Node tests and the quiz engine.
 */
import { PLAYER_IMAGE_KEYS, type PlayerImageKey } from './playerImageMeta.ts';

/** All currently registered offline image ids (players today). */
export const CHESS_CULTURE_REGISTERED_IMAGE_IDS: ReadonlySet<string> = new Set(
  PLAYER_IMAGE_KEYS,
);

export function listChessCultureImageIds(): string[] {
  return [...CHESS_CULTURE_REGISTERED_IMAGE_IDS];
}

export function hasChessCultureImage(imageId: string): boolean {
  return CHESS_CULTURE_REGISTERED_IMAGE_IDS.has(imageId);
}

export type { PlayerImageKey };
