/**
 * Session-global analysis memory (module singleton).
 * Survives Partie ↔ Analyse, library navigation, and reopening games.
 * Cleared on full app reload (no disk persistence of evals).
 */
import { AnalysisCache, makeAnalysisCacheKey } from './analysisCache.ts';
import type {
  AnalysisProfileId,
  GameNodeAnalysis,
  PositionAnalysis,
} from './types.ts';

export type SessionGameAnalysisRecord = {
  gameId: string;
  fingerprint: string;
  profileId: AnalysisProfileId;
  gameNodes: Record<string, GameNodeAnalysis>;
  mainLineNodeIds: string[];
  variantNodeIds: string[];
  mainLineComplete: boolean;
  variantsComplete: boolean;
  /** True when main line + all variants are present for this profile. */
  complete: boolean;
  updatedAt: number;
};

export function makeSessionGameKey(
  gameId: string,
  fingerprint: string,
  profileId: AnalysisProfileId,
): string {
  return `${gameId}::${fingerprint}::${profileId}`;
}

type Listener = () => void;

function analysisDevLog(message: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

class SessionAnalysisStoreImpl {
  /** Shared FEN+profile position cache for the whole app session. */
  readonly positions = new AnalysisCache();
  private readonly games = new Map<string, SessionGameAnalysisRecord>();
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  getPosition(
    fen: string,
    profileId: AnalysisProfileId,
    depth: number,
    multiPv: number,
  ): PositionAnalysis | undefined {
    return this.positions.get(
      makeAnalysisCacheKey(fen, profileId, depth, multiPv),
    );
  }

  logCacheLookup(fen: string, hit: boolean): void {
    const core = fen.split(/\s+/).slice(0, 4).join(' ');
    analysisDevLog(
      hit ? `Analysis cache HIT: ${core}` : `Analysis cache MISS: ${core}`,
    );
  }

  setPosition(
    fen: string,
    profileId: AnalysisProfileId,
    depth: number,
    multiPv: number,
    value: PositionAnalysis,
  ): void {
    this.positions.set(
      makeAnalysisCacheKey(fen, profileId, depth, multiPv),
      value,
    );
  }

  getGame(
    gameId: string,
    fingerprint: string,
    profileId: AnalysisProfileId,
  ): SessionGameAnalysisRecord | null {
    return (
      this.games.get(makeSessionGameKey(gameId, fingerprint, profileId)) ??
      null
    );
  }

  upsertGame(record: SessionGameAnalysisRecord): void {
    const key = makeSessionGameKey(
      record.gameId,
      record.fingerprint,
      record.profileId,
    );
    this.games.set(key, { ...record, updatedAt: Date.now() });
    this.emit();
  }

  setGameNode(
    gameId: string,
    fingerprint: string,
    profileId: AnalysisProfileId,
    node: GameNodeAnalysis,
    meta: {
      mainLineNodeIds: string[];
      variantNodeIds: string[];
    },
  ): SessionGameAnalysisRecord {
    const key = makeSessionGameKey(gameId, fingerprint, profileId);
    const prev = this.games.get(key);
    const gameNodes = { ...(prev?.gameNodes ?? {}), [node.nodeId]: node };
    const mainLineNodeIds = meta.mainLineNodeIds;
    const variantNodeIds = meta.variantNodeIds;
    const mainLineComplete =
      mainLineNodeIds.length > 0 &&
      mainLineNodeIds.every(
        (id) => gameNodes[id]?.profileId === profileId,
      );
    const variantsComplete =
      variantNodeIds.length === 0 ||
      variantNodeIds.every((id) => gameNodes[id]?.profileId === profileId);
    const complete = mainLineComplete && variantsComplete;
    const record: SessionGameAnalysisRecord = {
      gameId,
      fingerprint,
      profileId,
      gameNodes,
      mainLineNodeIds,
      variantNodeIds,
      mainLineComplete,
      variantsComplete,
      complete,
      updatedAt: Date.now(),
    };
    this.games.set(key, record);
    if (mainLineComplete && !prev?.mainLineComplete) {
      analysisDevLog('Main line complete');
    }
    if (complete && !prev?.complete) {
      analysisDevLog('Game analysis complete');
    }
    this.emit();
    return record;
  }

  /** Strict session badge: complete analysis available in memory. */
  isGameFullyAnalyzed(
    gameId: string,
    fingerprint: string | undefined | null,
    profileId?: AnalysisProfileId,
  ): boolean {
    const fp = fingerprint?.trim() || gameId;
    if (profileId) {
      return this.getGame(gameId, fp, profileId)?.complete === true;
    }
    for (const rec of this.games.values()) {
      if (rec.gameId === gameId && rec.fingerprint === fp && rec.complete) {
        return true;
      }
    }
    return false;
  }

  clearPositionsForProfile(_profileId: AnalysisProfileId): void {
    // Profile changes invalidate all position entries (depth/multiPv may differ).
    this.positions.clear();
  }

  reset(): void {
    this.positions.clear();
    this.games.clear();
    analysisDevLog('Analysis cache reset');
    this.emit();
  }

  get sizeGames(): number {
    return this.games.size;
  }

  get sizePositions(): number {
    return this.positions.size;
  }
}

export const sessionAnalysisStore = new SessionAnalysisStoreImpl();
