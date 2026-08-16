/**
 * Bundled player portrait requires for Expo/Metro.
 *
 * Stable keys only — filenames stay here, not in the question bank.
 * Metro needs static require() literals to include assets in the bundle.
 */
import type { ImageSourcePropType } from 'react-native';
import type { PlayerImageKey } from './playerImageMeta.ts';

/** Stable internal player keys → bundled require() sources. */
export const PLAYER_IMAGES = {
  gukesh: require('@/assets/chess-culture/players/Gukesh.jpg'),
  praggnanandhaa: require('@/assets/chess-culture/players/praggnanandhaa.jpg'),
  nepomniachtchi: require('@/assets/chess-culture/players/nepomniachtchi.jpg'),
  mvl: require('@/assets/chess-culture/players/mvl.jpg'),
  alirezaFirouzja: require('@/assets/chess-culture/players/Alirez-Firouzja.jpg'),
  hikaruNakamura: require('@/assets/chess-culture/players/Hikaru-Nakamura.jpg'),
  hansNiemann: require('@/assets/chess-culture/players/Niemann.jpg'),
  wesleySo: require('@/assets/chess-culture/players/Wesley-so.jpg'),
  anand: require('@/assets/chess-culture/players/Anand.jpg'),
  magnusCarlsen: require('@/assets/chess-culture/players/magnus carlsen.jpg'),
  dingLiren: require('@/assets/chess-culture/players/Liren.jpg'),
} as const satisfies Record<PlayerImageKey, ImageSourcePropType>;

export function getPlayerImage(key: string): ImageSourcePropType | null {
  if (!Object.prototype.hasOwnProperty.call(PLAYER_IMAGES, key)) return null;
  return PLAYER_IMAGES[key as PlayerImageKey];
}

export type { PlayerImageKey };
