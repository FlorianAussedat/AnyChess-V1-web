/**
 * « Défends la nulle » history and starred finales.
 *
 * History is a log of attempts (max 10, newest first), not unique positions.
 * Favorites are independent: evicting an attempt does not delete its star.
 *
 * Favorite identity (stable, documented):
 *   ddfav:{positionId}:{defender}:{placement} {stm} {castling} {ep}
 * The first four FEN fields are the play conditions. Halfmove and fullmove
 * clocks are ignored. The attempt id is never part of this key, so starring
 * the same initial position from several attempts yields one favorite.
 */
import type {
  AttemptOutcome,
  AttemptResult,
  DefenderColor,
  DrawAlternativeSummary,
  EvaluationPoint,
  OfficialDrawReason,
} from '../domain/types.ts';
import { sideToMoveFromFen } from '../domain/EvaluationNormalizer.ts';

export const DEFEND_DRAW_HISTORY_LIMIT = 10;
const RECORDED_ID_LIMIT = 200;

export type DefendDrawFavorite = {
  id: string;
  positionId: string;
  initialFen: string;
  playerColor: DefenderColor;
  sideToMove: 'w' | 'b';
  /** Present only when the user starred the position. Migrated rows omit it. */
  starredAt?: string;
};

export type DefendDrawHistoryAttempt = {
  id: string;
  positionId: string;
  initialFen: string;
  playerColor: DefenderColor;
  sideToMove: 'w' | 'b';
  moveSans: string[];
  outcome: Exclude<AttemptOutcome, 'in-progress'>;
  officialDrawReason?: OfficialDrawReason;
  checkmateWinner?: 'w' | 'b';
  movesResisted: number;
  /** Omitted when the legacy row had no date. Never invented. */
  finishedAt?: string;
  endFen: string;
  timeline: EvaluationPoint[];
  fenBeforeLoss?: string;
  losingSan?: string;
  evalBeforeLossCp?: number;
  evalAfterLossCp?: number;
  evalBeforeLossMate?: number | null;
  evalAfterLossMate?: number | null;
  drawAlternatives?: DrawAlternativeSummary[];
  drawAlternativesHasMore?: boolean;
  drawAlternativesReliable?: boolean;
};

export type FavoriteLookup = (
  positionId: string,
) => { fen: string; defender: DefenderColor } | null;

export function fenPlayConditions(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

export function defendDrawFavoriteId(
  positionId: string,
  defender: DefenderColor,
  initialFen: string,
): string {
  return `ddfav:${positionId}:${defender}:${fenPlayConditions(initialFen)}`;
}

export function createDefendDrawAttemptId(now: number = Date.now()): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `dda-${now.toString(36)}-${rand}`;
}

export function compareHistoryDesc(
  a: DefendDrawHistoryAttempt,
  b: DefendDrawHistoryAttempt,
): number {
  const aDated = a.finishedAt ? 1 : 0;
  const bDated = b.finishedAt ? 1 : 0;
  if (aDated !== bDated) return bDated - aDated;
  if ((a.finishedAt ?? '') !== (b.finishedAt ?? '')) {
    return (a.finishedAt ?? '') < (b.finishedAt ?? '') ? 1 : -1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/** Newest first. Equal dates break ties by attempt id descending. Undated rows stay last. */
export function capHistory(
  attempts: DefendDrawHistoryAttempt[],
  limit: number = DEFEND_DRAW_HISTORY_LIMIT,
): DefendDrawHistoryAttempt[] {
  return [...attempts].sort(compareHistoryDesc).slice(0, limit);
}

export function historyFromAttempt(
  result: AttemptResult,
  playerColor: DefenderColor,
): DefendDrawHistoryAttempt | null {
  if (result.outcome === 'in-progress') return null;
  if (!result.attemptId || !result.startFen || !result.positionId) return null;
  const row: DefendDrawHistoryAttempt = {
    id: result.attemptId,
    positionId: result.positionId,
    initialFen: result.startFen,
    playerColor,
    sideToMove: sideToMoveFromFen(result.startFen),
    moveSans: result.moveSans ?? [],
    outcome: result.outcome,
    movesResisted: result.movesResisted,
    endFen: result.endFen || result.startFen,
    timeline: result.timeline ?? [],
  };
  if (result.finishedAt) row.finishedAt = result.finishedAt;
  if (result.officialDrawReason) row.officialDrawReason = result.officialDrawReason;
  if (result.checkmateWinner) row.checkmateWinner = result.checkmateWinner;
  if (result.fenBeforeLoss) row.fenBeforeLoss = result.fenBeforeLoss;
  if (result.losingSan) row.losingSan = result.losingSan;
  if (result.evalBeforeLossCp != null) row.evalBeforeLossCp = result.evalBeforeLossCp;
  if (result.evalAfterLossCp != null) row.evalAfterLossCp = result.evalAfterLossCp;
  if (result.evalBeforeLossMate !== undefined) row.evalBeforeLossMate = result.evalBeforeLossMate;
  if (result.evalAfterLossMate !== undefined) row.evalAfterLossMate = result.evalAfterLossMate;
  if (result.drawAlternatives) row.drawAlternatives = result.drawAlternatives;
  if (result.drawAlternativesHasMore != null) {
    row.drawAlternativesHasMore = result.drawAlternativesHasMore;
  }
  if (result.drawAlternativesReliable != null) {
    row.drawAlternativesReliable = result.drawAlternativesReliable;
  }
  return row;
}

export function attemptFromHistory(row: DefendDrawHistoryAttempt): AttemptResult {
  const result: AttemptResult = {
    attemptId: row.id,
    outcome: row.outcome,
    movesResisted: row.movesResisted,
    timeline: row.timeline ?? [],
    moveSans: row.moveSans ?? [],
    startFen: row.initialFen,
    endFen: row.endFen || row.initialFen,
    positionId: row.positionId,
    finishedAt: row.finishedAt ?? '',
  };
  if (row.officialDrawReason) result.officialDrawReason = row.officialDrawReason;
  if (row.checkmateWinner) result.checkmateWinner = row.checkmateWinner;
  if (row.fenBeforeLoss) result.fenBeforeLoss = row.fenBeforeLoss;
  if (row.losingSan) result.losingSan = row.losingSan;
  if (row.evalBeforeLossCp != null) result.evalBeforeLossCp = row.evalBeforeLossCp;
  if (row.evalAfterLossCp != null) result.evalAfterLossCp = row.evalAfterLossCp;
  if (row.evalBeforeLossMate !== undefined) result.evalBeforeLossMate = row.evalBeforeLossMate;
  if (row.evalAfterLossMate !== undefined) result.evalAfterLossMate = row.evalAfterLossMate;
  if (row.drawAlternatives) result.drawAlternatives = row.drawAlternatives;
  if (row.drawAlternativesHasMore != null) {
    result.drawAlternativesHasMore = row.drawAlternativesHasMore;
  }
  if (row.drawAlternativesReliable != null) {
    result.drawAlternativesReliable = row.drawAlternativesReliable;
  }
  return result;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function isFavorite(raw: unknown): raw is DefendDrawFavorite {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as DefendDrawFavorite;
  return (
    typeof row.id === 'string' &&
    typeof row.positionId === 'string' &&
    typeof row.initialFen === 'string' &&
    (row.playerColor === 'white' || row.playerColor === 'black')
  );
}

function isHistory(raw: unknown): raw is DefendDrawHistoryAttempt {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as DefendDrawHistoryAttempt;
  const outcome = (raw as { outcome?: string }).outcome;
  return (
    typeof row.id === 'string' &&
    typeof row.positionId === 'string' &&
    typeof row.initialFen === 'string' &&
    (row.playerColor === 'white' || row.playerColor === 'black') &&
    (outcome === 'loss' ||
      outcome === 'abandoned' ||
      outcome === 'win-30-moves' ||
      outcome === 'win-official-draw')
  );
}

export function readFavorites(raw: unknown): DefendDrawFavorite[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: DefendDrawFavorite[] = [];
  for (const item of raw) {
    if (!isFavorite(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function readHistory(raw: unknown): DefendDrawHistoryAttempt[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: DefendDrawHistoryAttempt[] = [];
  for (const item of raw) {
    if (!isHistory(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return capHistory(out);
}

/**
 * Old « Essaie encore » ids become starred finales when the catalog still
 * knows the position. Unknown ids are skipped — no invented FEN, date, or result.
 */
export function migrateTryAgainToFavorites(
  tryAgainIds: string[],
  existing: DefendDrawFavorite[],
  lookup: FavoriteLookup,
): DefendDrawFavorite[] {
  const out = readFavorites(existing);
  const seen = new Set(out.map((item) => item.id));
  for (const positionId of tryAgainIds) {
    if (typeof positionId !== 'string' || !positionId) continue;
    const pos = lookup(positionId);
    if (!pos?.fen) continue;
    const favorite: DefendDrawFavorite = {
      id: defendDrawFavoriteId(positionId, pos.defender, pos.fen),
      positionId,
      initialFen: pos.fen,
      playerColor: pos.defender,
      sideToMove: sideToMoveFromFen(pos.fen),
    };
    if (seen.has(favorite.id)) continue;
    seen.add(favorite.id);
    out.push(favorite);
  }
  return out;
}

function deletedAtMap(raw: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const record = asRecord(raw);
  if (!record) return map;
  const dated = asRecord(record.favoriteDeletedAt);
  if (dated) {
    for (const [id, value] of Object.entries(dated)) {
      if (typeof value === 'string' && value) map.set(id, value);
    }
  }
  const ids = [
    ...((record.favoriteTombstones as unknown[]) ?? []),
    ...((record.syncDeletedIds as unknown[]) ?? []),
  ];
  for (const id of ids) {
    if (typeof id === 'string' && id && !map.has(id)) map.set(id, '');
  }
  return map;
}

function favoriteSurvives(favorite: DefendDrawFavorite, deletedAt: string | undefined): boolean {
  if (deletedAt === undefined) return true;
  // A tombstone without a time, or a migrated favorite, must not come back.
  if (!favorite.starredAt || !deletedAt) return false;
  return favorite.starredAt > deletedAt;
}

function mergeStats(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...left };
  for (const [id, value] of Object.entries(right)) {
    const prev = asRecord(out[id]);
    const next = asRecord(value);
    if (!prev) {
      out[id] = value;
      continue;
    }
    if (!next) continue;
    const prevN = typeof prev.attemptsFinished === 'number' ? prev.attemptsFinished : 0;
    const nextN = typeof next.attemptsFinished === 'number' ? next.attemptsFinished : 0;
    const prevAt = typeof prev.lastFinishedAt === 'string' ? prev.lastFinishedAt : '';
    const nextAt = typeof next.lastFinishedAt === 'string' ? next.lastFinishedAt : '';
    out[id] = nextN > prevN || nextAt > prevAt ? next : prev;
  }
  return out;
}

function uniqueCap(values: unknown, cap: number): string[] {
  const list = Array.isArray(values) ? values : [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string' || out.includes(item)) continue;
    out.push(item);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Cloud merge for the endgame training document.
 * History is unioned then capped at 10. Favorites are unioned and honor tombstones.
 * Expiring a history row does not tombstone its favorite.
 */
export function mergeEndgameTrainingDocuments(
  local: unknown,
  remote: unknown,
  lookup: FavoriteLookup,
): unknown {
  const a = asRecord(local);
  const b = asRecord(remote);
  if (!a) return b;
  if (!b) return a;

  const deleted = deletedAtMap(a);
  for (const [id, at] of deletedAtMap(b)) {
    const prev = deleted.get(id);
    if (prev === undefined || at > prev) deleted.set(id, at);
  }

  const localFavorites = Array.isArray(a.favorites)
    ? readFavorites(a.favorites)
    : migrateTryAgainToFavorites(
        Array.isArray(a.tryAgainIds) ? (a.tryAgainIds as string[]) : [],
        [],
        lookup,
      );
  const remoteFavorites = Array.isArray(b.favorites)
    ? readFavorites(b.favorites)
    : migrateTryAgainToFavorites(
        Array.isArray(b.tryAgainIds) ? (b.tryAgainIds as string[]) : [],
        [],
        lookup,
      );

  const byId = new Map<string, DefendDrawFavorite>();
  for (const favorite of [...localFavorites, ...remoteFavorites]) {
    const prev = byId.get(favorite.id);
    if (!prev) {
      byId.set(favorite.id, favorite);
      continue;
    }
    const prevAt = prev.starredAt ?? '';
    const nextAt = favorite.starredAt ?? '';
    if (nextAt >= prevAt) byId.set(favorite.id, favorite);
  }
  const favorites = [...byId.values()].filter((favorite) =>
    favoriteSurvives(favorite, deleted.has(favorite.id) ? deleted.get(favorite.id) : undefined),
  );
  const dropped = new Set(
    [...byId.keys()].filter((id) => !favorites.some((favorite) => favorite.id === id)),
  );
  for (const id of dropped) {
    if (!deleted.has(id)) deleted.set(id, '');
  }

  const history = capHistory([
    ...readHistory(a.history),
    ...readHistory(b.history),
  ]);

  const finished = [
    ...((Array.isArray(a.finishedIds) ? a.finishedIds : []) as unknown[]),
    ...((Array.isArray(b.finishedIds) ? b.finishedIds : []) as unknown[]),
  ].filter((id): id is string => typeof id === 'string');

  const recorded = [
    ...((Array.isArray(a.recordedAttemptIds) ? a.recordedAttemptIds : []) as unknown[]),
    ...((Array.isArray(b.recordedAttemptIds) ? b.recordedAttemptIds : []) as unknown[]),
    ...history.map((row) => row.id),
  ].filter((id): id is string => typeof id === 'string');

  const aAt = typeof a.updatedAt === 'string' ? a.updatedAt : '';
  const bAt = typeof b.updatedAt === 'string' ? b.updatedAt : '';
  const newer = bAt > aAt ? b : a;
  const favoriteDeletedAt: Record<string, string> = {};
  for (const [id, at] of deleted) favoriteDeletedAt[id] = at;

  return {
    ...a,
    ...b,
    version: 2,
    favorites,
    history,
    favoriteTombstones: [...deleted.keys()],
    favoriteDeletedAt,
    syncDeletedIds: [...deleted.keys()],
    tryAgainIds: favorites.map((favorite) => favorite.positionId),
    finishedIds: [...new Set(finished)],
    statsByPosition: mergeStats(
      (asRecord(a.statsByPosition) ?? {}) as Record<string, unknown>,
      (asRecord(b.statsByPosition) ?? {}) as Record<string, unknown>,
    ),
    recordedAttemptIds: [...new Set(recorded)].slice(0, RECORDED_ID_LIMIT),
    recentFamilies: uniqueCap(
      [...((a.recentFamilies as unknown[]) ?? []), ...((b.recentFamilies as unknown[]) ?? [])],
      8,
    ),
    recentSignatures: uniqueCap(
      [
        ...((a.recentSignatures as unknown[]) ?? []),
        ...((b.recentSignatures as unknown[]) ?? []),
      ],
      8,
    ),
    showGauge: newer.showGauge !== false,
    datasetVersion:
      typeof newer.datasetVersion === 'string'
        ? newer.datasetVersion
        : typeof a.datasetVersion === 'string'
          ? a.datasetVersion
          : b.datasetVersion,
    updatedAt: aAt >= bAt ? aAt || bAt : bAt || aAt,
  };
}

/** Cancel leaves both collections unchanged. Remove drops only the favorite. */
export function applyUnstarChoice<TFav extends { id: string }, THist>(
  favorites: TFav[],
  history: THist[],
  favoriteId: string,
  action: 'cancel' | 'remove',
): { favorites: TFav[]; history: THist[] } {
  if (action === 'cancel') return { favorites, history };
  return {
    favorites: favorites.filter((item) => item.id !== favoriteId),
    history,
  };
}
