/**
 * Canonical map: stable semantic imageId → bundled local asset.
 *
 * questions.ts references imageId only.
 * This file owns the static require() wiring Metro needs.
 * Actual files live under assets/chess-culture/.
 *
 * Do NOT invent placeholder portraits. Only register assets that exist on disk.
 */
import type { ImageSourcePropType } from 'react-native';

/**
 * Register bundled Culture générale visuals here as files are added, e.g.:
 *
 * 'player-bobby-fischer':
 *   require('@/assets/chess-culture/players/bobby-fischer.webp'),
 */
export const CHESS_CULTURE_IMAGE_REGISTRY = {
  // Intentionally empty until real offline assets are added.
} as const satisfies Record<string, ImageSourcePropType>;

export type ChessCultureRegisteredImageId = keyof typeof CHESS_CULTURE_IMAGE_REGISTRY;

export function listChessCultureImageIds(): string[] {
  return Object.keys(CHESS_CULTURE_IMAGE_REGISTRY);
}

export function hasChessCultureImage(imageId: string): boolean {
  return Object.prototype.hasOwnProperty.call(CHESS_CULTURE_IMAGE_REGISTRY, imageId);
}

/**
 * Resolve a semantic imageId to a bundled source.
 * Returns null when missing — callers must not crash.
 */
export function getChessCultureImage(imageId: string): ImageSourcePropType | null {
  if (!hasChessCultureImage(imageId)) return null;
  return CHESS_CULTURE_IMAGE_REGISTRY[imageId as ChessCultureRegisteredImageId];
}

/** Pure helper for tests / defensive UI — never throws. */
export function resolveChessCultureImageSource(
  imageId: string | undefined,
  lookup: (id: string) => ImageSourcePropType | null = getChessCultureImage,
): ImageSourcePropType | null {
  if (typeof imageId !== 'string' || imageId.length === 0) return null;
  try {
    return lookup(imageId);
  } catch {
    return null;
  }
}
