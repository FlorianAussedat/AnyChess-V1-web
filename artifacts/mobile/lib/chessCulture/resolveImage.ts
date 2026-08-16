/**
 * Defensive imageId → source resolution (no asset requires).
 */
import type { ImageSourcePropType } from 'react-native';

/** Pure helper — never throws. Callers supply lookup (registry or mock). */
export function resolveChessCultureImageSource(
  imageId: string | undefined,
  lookup: (id: string) => ImageSourcePropType | null,
): ImageSourcePropType | null {
  if (typeof imageId !== 'string' || imageId.length === 0) return null;
  try {
    return lookup(imageId);
  } catch {
    return null;
  }
}
