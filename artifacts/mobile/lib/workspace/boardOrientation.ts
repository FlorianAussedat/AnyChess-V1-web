import { sideFromFen } from './variantTree.ts';

export type BoardOrientation = 'white' | 'black';

/** Initial board orientation for an imported FEN: follow the side to move. */
export function initialOrientationFromFen(fen: string): BoardOrientation {
  return sideFromFen(fen);
}

export function flipOrientation(orientation: BoardOrientation): BoardOrientation {
  return orientation === 'white' ? 'black' : 'white';
}

/**
 * Display-only flip. Chess identity (FEN, turn, node, branch, eval) is unchanged.
 */
export function applyDisplayFlip<T extends { orientation: BoardOrientation }>(
  snapshot: T,
): T {
  return { ...snapshot, orientation: flipOrientation(snapshot.orientation) };
}
