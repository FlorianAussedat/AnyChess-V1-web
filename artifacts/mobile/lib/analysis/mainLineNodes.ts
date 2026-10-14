import type { ReaderGame, ReaderNode } from '@/lib/gameReader';

export type MainLineNodeRef = {
  nodeId: string;
  fen: string;
  fenBefore: string;
  san: string;
  moveNumber: number;
  color: 'white' | 'black';
};

/** Walk the main continuation (childIds[0]) from the main root move. */
export function collectMainLineNodes(game: ReaderGame): MainLineNodeRef[] {
  const out: MainLineNodeRef[] = [];
  const rootId = game.rootIds[0];
  if (!rootId) return out;
  let id: string | null = rootId;
  while (id) {
    const node: ReaderNode | undefined = game.nodesById[id];
    if (!node) break;
    out.push({
      nodeId: node.id,
      fen: node.fenAfter,
      fenBefore: node.fenBefore,
      san: node.san,
      moveNumber: node.moveNumber,
      color: node.color,
    });
    id = node.childIds[0] ?? null;
  }
  return out;
}

/** Active branch line from the reader's activeLineNodeIds. */
export function collectActiveLineNodes(
  game: ReaderGame,
  activeLineNodeIds: string[],
): MainLineNodeRef[] {
  const out: MainLineNodeRef[] = [];
  for (const id of activeLineNodeIds) {
    const node = game.nodesById[id];
    if (!node) continue;
    out.push({
      nodeId: node.id,
      fen: node.fenAfter,
      fenBefore: node.fenBefore,
      san: node.san,
      moveNumber: node.moveNumber,
      color: node.color,
    });
  }
  return out;
}
