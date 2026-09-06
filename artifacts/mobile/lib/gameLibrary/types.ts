/**
 * Game Library / Lecteur de parties — imported PGN games.
 */
export type ImportedGameHeaders = {
  white?: string;
  black?: string;
  result?: string;
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  whiteElo?: string;
  blackElo?: string;
  timeControl?: string;
  eco?: string;
  opening?: string;
  variation?: string;
};

export type ImportedGameMove = {
  /** 1-based ply index in the main line. */
  ply: number;
  /** Canonical English SAN (chess.js). */
  san: string;
  /** Full FEN after this ply. */
  fenAfter: string;
  comment?: string;
  /** Remaining clock after this move when PGN contains [%clk …]. */
  clock?: string;
  nags?: string[];
};

/** Minimal persisted analysis badge — not the full Stockfish cache. */
export type GameAnalysisMeta = {
  hasBeenAnalyzed: boolean;
  analyzedAt: number;
  /** Analysis profile id used last (`fast` | `normal` | `deep`). */
  profileId: string;
};

export type ImportedChessGame = {
  id: string;
  /** User-provided title when PGN metadata has no usable name. */
  displayName?: string;
  /** Content fingerprint for duplicate detection (not filename). */
  fingerprint: string;
  headers: ImportedGameHeaders;
  /** Starting position FEN (standard start if omitted in PGN). */
  initialFen: string;
  moves: ImportedGameMove[];
  /**
   * V1 plays the main line only. When true, the original PGN contained
   * side variations — preserved in `source.rawPgn` for future readers.
   */
  hasVariations: boolean;
  source: {
    fileName?: string;
    importedAt: number;
    /** Original game text (headers + movetext) for future variation support. */
    rawPgn?: string;
  };
  /**
   * Honest library badge only. Full engine lines stay in-session memory.
   */
  analysis?: GameAnalysisMeta;
};

export type GameLibrarySnapshot = {
  version: 1;
  games: ImportedChessGame[];
};

export type ImportPgnResult = {
  imported: ImportedChessGame[];
  skippedDuplicates: number;
  skippedInvalid: number;
  errors: string[];
};
