/**
 * @deprecated Prefer `AnyChessSplashScreen`. Kept as a thin alias so older imports keep working.
 *
 * Merge note (0.0.4 ↔ 0.0.4.1): `feature/WIP-Major-Update-0.0.4` reintroduced a full
 * BrandSplash implementation that also preloads home WebPs. This branch keeps the
 * AnyChessSplashScreen architecture; WebP preload lives in AnyChessSplashScreen instead.
 */
export {
  AnyChessSplashScreen as BrandSplash,
  AnyChessSplashScreen,
} from '@/components/AnyChessSplashScreen';
export type { AnyChessSplashScreenProps } from '@/components/AnyChessSplashScreen';
