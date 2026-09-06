import type { ImportedGameHeaders } from '@/lib/gameLibrary/types';

export type ReaderColor = 'white' | 'black';

/** Move enriched for the shared Lecteur / Analyseur core. */
export type ReaderMove = {
  /** 1-based ply index on the main line. */
  ply: number;
  moveNumber: number;
  color: ReaderColor;
  /** Canonical English SAN (chess.js). */
  san: string;
  fenBefore: string;
  fenAfter: string;
  from?: string;
  to?: string;
  promotion?: string;
  comment?: string;
  nags?: string[];
  /** True when this ply had side variations in the PGN tree. */
  hasVariations?: boolean;
};

export type ReaderHeaders = ImportedGameHeaders;

export type ReaderGame = {
  id: string;
  fingerprint?: string;
  headers: ReaderHeaders;
  initialFen: string;
  moves: ReaderMove[];
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
 * Full derived reader snapshot. Pure helpers return this shape;
 * the React hook exposes the same fields plus navigation methods.
 */
export type GameReaderState = {
  game: ReaderGame;
  currentPly: number;
  totalPly: number;
  currentFen: string;
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
};

export type ParsePgnOk = { ok: true; game: ReaderGame };
export type ParsePgnErr = { ok: false; error: string; detail?: string };
export type ParsePgnResult = ParsePgnOk | ParsePgnErr;
