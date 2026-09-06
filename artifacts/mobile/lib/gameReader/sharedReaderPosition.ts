/**
 * Shared Lecteur ↔ Analyseur position.
 * Identity = gameId + nodeId (ply alone is ambiguous with variations).
 */
export type SharedReaderPosition = {
  gameId: string;
  nodeId: string | null;
  fen: string;
  boardFlipped: boolean;
  activeLineNodeIds?: string[];
  updatedAt: number;
};

let memory: SharedReaderPosition | null = null;

export function saveSharedReaderPosition(
  position: Omit<SharedReaderPosition, 'updatedAt'>,
): SharedReaderPosition {
  memory = { ...position, updatedAt: Date.now() };
  return memory;
}

export function loadSharedReaderPosition(
  gameId?: string,
): SharedReaderPosition | null {
  if (!memory) return null;
  if (gameId && memory.gameId !== gameId) return null;
  return memory;
}

export function clearSharedReaderPosition(): void {
  memory = null;
}
