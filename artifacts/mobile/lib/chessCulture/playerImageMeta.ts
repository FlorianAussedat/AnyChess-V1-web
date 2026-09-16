/**
 * Player portrait metadata (no React Native asset requires).
 */
export const PLAYER_IMAGE_KEYS = [
  'gukesh',
  'praggnanandhaa',
  'nepomniachtchi',
  'mvl',
  'alirezaFirouzja',
  'hikaruNakamura',
  'hansNiemann',
  'wesleySo',
  'anand',
  'magnusCarlsen',
  'dingLiren',
] as const;

export type PlayerImageKey = (typeof PLAYER_IMAGE_KEYS)[number];

/** Canonical identity labels (must match quiz answers / photo mapping). */
export const PLAYER_IMAGE_IDENTITIES = {
  gukesh: 'Gukesh D',
  praggnanandhaa: 'Rameshbabu Praggnanandhaa',
  nepomniachtchi: 'Ian Nepomniachtchi',
  mvl: 'Maxime Vachier-Lagrave',
  alirezaFirouzja: 'Alireza Firouzja',
  hikaruNakamura: 'Hikaru Nakamura',
  hansNiemann: 'Hans Niemann',
  wesleySo: 'Wesley So',
  anand: 'Viswanathan Anand',
  magnusCarlsen: 'Magnus Carlsen',
  dingLiren: 'Ding Liren',
} as const satisfies Record<PlayerImageKey, string>;

/** Exact on-disk filenames under assets/chess-culture/players/. */
export const PLAYER_IMAGE_FILENAMES = {
  gukesh: 'Gukesh.jpg',
  praggnanandhaa: 'praggnanandhaa.jpg',
  nepomniachtchi: 'nepomniachtchi.jpg',
  mvl: 'mvl.jpg',
  alirezaFirouzja: 'Alirez-Firouzja.jpg',
  hikaruNakamura: 'Hikaru-Nakamura.jpg',
  hansNiemann: 'Niemann.jpg',
  wesleySo: 'Wesley-so.jpg',
  anand: 'Anand.jpg',
  magnusCarlsen: 'magnus carlsen.jpg',
  dingLiren: 'Liren.jpg',
} as const satisfies Record<PlayerImageKey, string>;

export function isPlayerImageKey(value: string): value is PlayerImageKey {
  return (PLAYER_IMAGE_KEYS as readonly string[]).includes(value);
}
