import type { ImportedGameHeaders } from '@/lib/gameLibrary/types';

export type ReaderColor = 'white' | 'black';

/**
 * One legalized move node in the PGN tree (main line or variation).
 * Stable `id` identifies position in the tree (ply alone is ambiguous with branches).
 */
export type ReaderNode = {
  id: string;
  /** Canonical English SAN (chess.js). */
  san: string;
  fenBefore: string;
  fenAfter: string;
  from?: string;
  to?: string;
  promotion?: string;
  moveNumber: number;
  color: ReaderColor;
  comment?: string;
  nags?: string[];
  parentId: string | null;
  /** Continuations after this move: [0] = main continuation at this fork. */
  childIds: string[];
  /** 0 = main choice among siblings; 1+ = side variation. */
  variationIndex: number;
  /** 0 = main line; deeper = nested variations. */
  depth: number;
};

/**
 * Flat main-line move (backward-compatible projection).
 * Prefer `nodesById` / `currentNodeId` when branches matter.
 */
export type ReaderMove = {
  /** 1-based ply index on the main line. */
  ply: number;
  moveNumber: number;
  color: ReaderColor;
  san: string;
  fenBefore: string;
  fenAfter: string;
  from?: string;
  to?: string;
  promotion?: string;
  comment?: string;
  nags?: string[];
  hasVariations?: boolean;
  /** Stable tree node id when the game was built with a variation tree. */
  nodeId?: string;
};

export type ReaderHeaders = ImportedGameHeaders;

export type ReaderGame = {
  id: string;
  fingerprint?: string;
  headers: ReaderHeaders;
  initialFen: string;
  /** Main-line moves (depth 0 path). Kept for compatibility and list UIs. */
  moves: ReaderMove[];
  /** All nodes keyed by stable id. Empty object for legacy flat games. */
  nodesById: Record<string, ReaderNode>;
  /** First-move options from the start position (main + alternatives). */
  rootIds: string[];
  hasVariations: boolean;
  result?: string;
  rawPgn?: string;
  source?: {
    fileName?: string;
    importedAt: number;
    rawPgn?: string;
  };
};

/**
 * Derived reader snapshot. Navigation follows the active branch line
 * (`activeLineNodeIds`), not only the flat main line.
 */
export type GameReaderState = {
  game: ReaderGame;
  /** Index along the active line (0 = start position). */
  currentPly: number;
  /** Length of the active line (not necessarily main-line length). */
  totalPly: number;
  currentFen: string;
  /** Active-line move at currentPly, or null at start. */
  currentMove: ReaderMove | null;
  previousMove: ReaderMove | null;
  nextMove: ReaderMove | null;
  currentSan: string | null;
  currentMoveNumber: number | null;
  sideToMove: ReaderColor;
  lastMoveSquares: { from: string; to: string } | null;
  canGoBack: boolean;
  canGoForward: boolean;
  boardFlipped: boolean;
  /** Node at current position, or null at start. */
  currentNodeId: string | null;
  /** Full active branch from first move to end of that line. */
  activeLineNodeIds: string[];
};

export type ParsePgnOk = { ok: true; game: ReaderGame };
export type ParsePgnErr = { ok: false; error: string; detail?: string };
export type ParsePgnResult = ParsePgnOk | ParsePgnErr;
