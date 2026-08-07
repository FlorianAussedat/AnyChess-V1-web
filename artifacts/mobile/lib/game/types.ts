import type { MoveInputSource } from '../moveInput/canonicalMove.ts';

export type PlayerColor = 'w' | 'b';

export type BoardPiece = {
  square: string;
  type: string;
  color: 'w' | 'b';
};

export type LastMove = { from: string; to: string };

/** Emitted after every user-move attempt so the UI can trigger haptics/sounds. */
export type MoveEvent = {
  kind: 'success' | 'error';
  id: number;
  source?: MoveInputSource;
};

export type SideChoice = 'w' | 'b' | 'random';

export type MoveRow = { key: string; num: number; white: string; black: string };
