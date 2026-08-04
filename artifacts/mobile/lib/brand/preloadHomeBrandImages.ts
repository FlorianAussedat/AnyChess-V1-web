/**
 * Warm home brand images into the expo-image cache during splash
 * so ModeCards and Accueil nav paint without waiting on first decode.
 */
import { Image } from 'expo-image';
import { homeBrandImageModules } from '@/constants/BrandAssets';

let preloadPromise: Promise<void> | null = null;

export function preloadHomeBrandImages(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const modules = homeBrandImageModules().filter(
    (m): m is number => typeof m === 'number',
  );
  preloadPromise = Promise.all(
    modules.map((mod) => Image.loadAsync(mod).catch(() => null)),
  ).then(() => undefined);
  return preloadPromise;
}
