/**
 * Canonical map: stable semantic imageId → bundled local asset.
 *
 * Questions reference imageId only (e.g. magnusCarlsen).
 * This file owns the static require() wiring Metro needs.
 * Actual files live under assets/chess-culture/.
 *
 * Do NOT invent placeholder portraits. Only register assets that exist on disk.
 */
import type { ImageSourcePropType } from 'react-native';
import { hasChessCultureImage, listChessCultureImageIds } from './imageRegistryIds.ts';
import { PLAYER_IMAGES } from './playerImages.ts';
import { resolveChessCultureImageSource as resolveWithLookup } from './resolveImage.ts';

/**
 * Register bundled Culture générale visuals here as files are added.
 * Player portraits: see playerImages.ts (stable keys).
 */
export const CHESS_CULTURE_IMAGE_REGISTRY = {
  ...PLAYER_IMAGES,
} as const satisfies Record<string, ImageSourcePropType>;

export type ChessCultureRegisteredImageId = keyof typeof CHESS_CULTURE_IMAGE_REGISTRY;

export { listChessCultureImageIds, hasChessCultureImage };

/**
 * Resolve a semantic imageId to a bundled source.
 * Returns null when missing — callers must not crash.
 */
export function getChessCultureImage(imageId: string): ImageSourcePropType | null {
  if (!hasChessCultureImage(imageId)) return null;
  return CHESS_CULTURE_IMAGE_REGISTRY[imageId as ChessCultureRegisteredImageId];
}

/** Registry-backed resolve for UI — never throws. */
export function resolveChessCultureImageSource(
  imageId: string | undefined,
): ImageSourcePropType | null {
  return resolveWithLookup(imageId, getChessCultureImage);
}
