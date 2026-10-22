import { migrateOpeningHierarchy } from '../repertoire/folderTree.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { mergeEndgameTrainingDocuments } from '../endgameTraining/persistence/defendDrawReview.ts';
import { mergeTheoreticalDocuments } from '../theoreticalEndgame/persistence/TheoreticalEndgameStore.ts';
import { getPositionById } from '../endgameTraining/selection/selectors.ts';
import { mergeRecordDocument } from '../records/scoreDocument.ts';

function compareText(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

function newerIso(a?: string, b?: string): string {
  if (!a) return b ?? new Date().toISOString();
  if (!b) return a;
  return a >= b ? a : b;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function mergeById<T extends { id: string }>(
  left: T[],
  right: T[],
  deleted: Set<string>,
  pick: (a: T, b: T) => T,
): T[] {
  const map = new Map<string, T>();
  for (const item of [...left, ...right]) {
    if (!item?.id || deleted.has(item.id)) continue;
    const prev = map.get(item.id);
    map.set(item.id, prev ? pick(prev, item) : item);
  }
  return [...map.values()];
}

function timestampOf(item: object): string {
  const row = item as { updatedAt?: string | number; importedAt?: string | number; createdAt?: string | number; source?: { importedAt?: number } };
  const at = row.updatedAt || row.importedAt || row.createdAt || row.source?.importedAt || '';
  return typeof at === 'number' ? new Date(at).toISOString() : at;
}

/** Stable recovery IDs keep PGN versions without generating a new copy on every sync. */
function contentHash(text: string): string {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return (a >>> 0).toString(16) + (b >>> 0).toString(16);
}
function mergeStudies<T extends { id: string }>(left: T[], right: T[], deleted: Set<string>, content: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of [...left, ...right].sort((a, b) => compareText(JSON.stringify(a), JSON.stringify(b)))) {
    if (!item?.id || deleted.has(item.id)) continue;
    const previous = map.get(item.id);
    if (!previous) { map.set(item.id, item); continue; }
    const older = timestampOf(previous) > timestampOf(item) ? item : previous;
    const newer = older === item ? previous : item;
    if (content(previous) !== content(item)) {
      const id = `${item.id}~recovery-${contentHash(content(older))}`;
      if (!deleted.has(id)) {
        const recovery = { ...older, id } as T & { filename?: string; displayName?: string; fingerprint?: string };
        if (typeof recovery.filename === 'string') recovery.filename = recovery.filename.replace(/\.pgn$/i, '') + ` [${id.slice(-8)}].pgn`;
        if ('displayName' in recovery) recovery.displayName = `${recovery.displayName ?? 'PGN'} [${id.slice(-8)}]`;
        if (recovery.fingerprint) recovery.fingerprint += `:${id}`;
        map.set(id, recovery);
      }
    }
    map.set(item.id, newer);
  }
  return [...map.values()].sort((a, b) => compareText(a.id, b.id));
}

function mergeRepertoire(local: unknown, remote: unknown): unknown {
  const a = asRecord(local);
  const b = asRecord(remote);
  if (!a) return b;
  if (!b) return a;
  const deleted = new Set<string>([
    ...((a.syncDeletedIds as string[]) ?? []),
    ...((b.syncDeletedIds as string[]) ?? []),
  ]);
  const folders = mergeById(
    (Array.isArray(a.folders) ? a.folders : []) as { id: string; updatedAt?: string }[],
    (Array.isArray(b.folders) ? b.folders : []) as { id: string; updatedAt?: string }[],
    deleted,
    (x, y) => (timestampOf(x) >= timestampOf(y) ? x : y),
  );
  const filesLeft = (Array.isArray(a.files) ? a.files : []) as {
    id: string;
    filename?: string;
    pgnText?: string;
    importedAt?: string;
  }[];
  const filesRight = (Array.isArray(b.files) ? b.files : []) as typeof filesLeft;
  const deduped = mergeStudies(filesLeft, filesRight, deleted, file => file.pgnText ?? '');
  const merged = migrateOpeningHierarchy({
    version: 2 as const,
    folders: folders as { id: string; name: string; parentId?: string | null }[],
    files: deduped as { id: string; folderId: string; filename: string }[],
    syncDeletedIds: [...deleted],
  }).snapshot;
  return {
    ...a,
    ...b,
    ...merged,
    version: 2,
    folders: merged.folders,
    files: merged.files,
    syncDeletedIds: [...deleted],
  };
}

function mergeGameLibrary(local: unknown, remote: unknown): unknown {
  const a = asRecord(local);
  const b = asRecord(remote);
  if (!a) return b;
  if (!b) return a;
  const deleted = new Set<string>([
    ...((a.syncDeletedIds as string[]) ?? []),
    ...((b.syncDeletedIds as string[]) ?? []),
  ]);
  const folders = mergeById(
    (Array.isArray(a.folders) ? a.folders : []) as { id: string; updatedAt?: string }[],
    (Array.isArray(b.folders) ? b.folders : []) as { id: string; updatedAt?: string }[],
    deleted,
    (x, y) => (timestampOf(x) >= timestampOf(y) ? x : y),
  );
  const left = (Array.isArray(a.games) ? a.games : []) as { id: string; source?: { rawPgn?: string }; moves?: unknown }[];
  const right = (Array.isArray(b.games) ? b.games : []) as typeof left;
  const deduped = mergeStudies(left, right, deleted, game => game.source?.rawPgn ?? JSON.stringify(game.moves ?? []));
  return { ...a, ...b, folders, games: deduped, syncDeletedIds: [...deleted] };
}

function deletedIdSet(...sources: unknown[]): Set<string> {
  const ids = new Set<string>();
  for (const source of sources) {
    const record = asRecord(source);
    const list = record?.syncDeletedIds;
    if (!Array.isArray(list)) continue;
    for (const id of list) {
      if (typeof id === 'string' && id) ids.add(id);
    }
  }
  return ids;
}

function dropDeletedKeys(
  bag: Record<string, unknown>,
  deleted: Set<string>,
): Record<string, unknown> {
  if (deleted.size === 0) return bag;
  const next = { ...bag };
  for (const id of deleted) delete next[id];
  return next;
}

function mergeEntries(left: unknown, right: unknown): Record<string, unknown> {
  const a = asRecord(left) ?? {}, b = asRecord(right) ?? {};
  const out: Record<string, unknown> = {};
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const x = asRecord(a[key]), y = asRecord(b[key]);
    if (!x || !y) { out[key] = a[key] ?? b[key]; continue; }
    const at = String(x.lastRevisionAt ?? x.updatedAt ?? ''), bt = String(y.lastRevisionAt ?? y.updatedAt ?? '');
    const winner = at > bt || (at === bt && JSON.stringify(x) >= JSON.stringify(y)) ? x : y;
    const merged = { ...winner };
    for (const field of ['totalAttempts', 'totalSuccesses']) {
      if (typeof x[field] === 'number' && typeof y[field] === 'number') merged[field] = Math.max(x[field] as number, y[field] as number);
    }
    out[key] = merged;
  }
  return out;
}

function mergeKeyedRecords(local: unknown, remote: unknown): unknown {
  const a = asRecord(local);
  const b = asRecord(remote);
  if (!a) return b;
  if (!b) return a;
  const deleted = deletedIdSet(a, b);
  const records = dropDeletedKeys(
    mergeEntries(a.records, b.records),
    deleted,
  );
  if (a.records || b.records) {
    return { ...a, ...b, records, syncDeletedIds: [...deleted] };
  }
  const lines = dropDeletedKeys(
    mergeEntries(a.lines, b.lines),
    deleted,
  );
  if (a.lines || b.lines) {
    return { ...a, ...b, lines, syncDeletedIds: [...deleted] };
  }
  const jobs = dropDeletedKeys(
    mergeEntries(a.jobs, b.jobs),
    deleted,
  );
  if (a.jobs || b.jobs) {
    return { ...a, ...b, jobs, syncDeletedIds: [...deleted] };
  }
  const questions = dropDeletedKeys(
    mergeEntries(a.questions, b.questions),
    deleted,
  );
  if (a.questions || b.questions) {
    return { ...a, ...b, questions, syncDeletedIds: [...deleted] };
  }
  return lastWriteWins(a, b);
}

const PREFERENCE_META_KEYS = new Set(['preferencesOrigin', 'manualFields', 'updatedAt', 'version']);

/**
 * New account (no remote document): the caller keeps the guest document.
 * Existing account: phone defaults must not replace cloud preferences.
 * Fields the guest actually changed are copied onto the cloud document.
 * Older documents without `preferencesOrigin` stay last-write-wins.
 */
export function mergeUserPreferences(local: unknown, remote: unknown): unknown {
  const a = asRecord(local);
  const b = asRecord(remote);
  if (!a) return b;
  if (!b) return a;
  if (a.preferencesOrigin !== 'device') return lastWriteWins(local, remote);

  const manual = Array.isArray(a.manualFields)
    ? a.manualFields.filter(
        (key): key is string =>
          typeof key === 'string' && key.length > 0 && !PREFERENCE_META_KEYS.has(key),
      )
    : [];
  if (manual.length === 0) return b;

  const out: Record<string, unknown> = { ...b };
  for (const key of manual) {
    if (key in a) out[key] = a[key];
  }
  const remoteManual = Array.isArray(b.manualFields)
    ? b.manualFields.filter((key): key is string => typeof key === 'string' && key.length > 0)
    : [];
  out.manualFields = [...new Set([...remoteManual, ...manual])];
  if (b.preferencesOrigin === 'user' || b.preferencesOrigin === 'device') {
    out.preferencesOrigin = b.preferencesOrigin;
  }
  out.updatedAt = newerIso(
    typeof a.updatedAt === 'string' ? a.updatedAt : '',
    typeof b.updatedAt === 'string' ? b.updatedAt : '',
  );
  return out;
}

function lastWriteWins(local: unknown, remote: unknown): unknown {
  const a = asRecord(local);
  const b = asRecord(remote);
  if (!a) return b;
  if (!b) return a;
  const aAt = typeof a.updatedAt === 'string' ? a.updatedAt : '';
  const bAt = typeof b.updatedAt === 'string' ? b.updatedAt : '';
  return (aAt > bAt || (aAt === bAt && JSON.stringify(a) >= JSON.stringify(b))) ? { ...b, ...a, updatedAt: newerIso(aAt, bAt) } : { ...a, ...b, updatedAt: newerIso(aAt, bAt) };
}

function isRecordDocumentKey(docKey: string): boolean {
  return (
    docKey === StorageKeys.openingQuizRecords.key ||
    docKey === StorageKeys.moveNamingSession60.key ||
    docKey === StorageKeys.playMoveSession60.key ||
    docKey === StorageKeys.blindMemoryRecords.key ||
    docKey === StorageKeys.puzzleStreaks.key
  );
}

function mergeHistoryList(local: unknown, remote: unknown): unknown {
  const a = asRecord(local);
  const b = asRecord(remote);
  if (!a) return b;
  if (!b) return a;
  const seen = [...((a.seen as string[]) ?? []), ...((b.seen as string[]) ?? [])];
  const unique = [...new Set(seen)].slice(-2000);
  return { ...a, ...b, seen: unique };
}

export function mergeDocumentPayload(
  docKey: string,
  localRaw: string | null,
  remoteRaw: string | null,
): string | null {
  if (!localRaw) return remoteRaw;
  if (!remoteRaw) return localRaw;
  if (localRaw === remoteRaw) return localRaw;
  const local = parseJson(localRaw);
  const remote = parseJson(remoteRaw);
  let merged: unknown;
  if (docKey === StorageKeys.puzzleHistory.key && Array.isArray(local) && Array.isArray(remote)) {
    const history = new Map<string, Record<string, unknown>>();
    for (const entry of [...local, ...remote]) {
      if (!entry || typeof entry !== 'object') continue;
      history.set(JSON.stringify(entry), entry);
    }
    merged = [...history.values()].sort((a, b) => compareText(String(b.playedAt), String(a.playedAt))).slice(0, 200);
  } else if (docKey === StorageKeys.continueLineRecent.key) {
    const a = asRecord(local) ?? {}, b = asRecord(remote) ?? {};
    merged = Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map(key => [key, [...new Set([...(Array.isArray(a[key]) ? a[key] : []), ...(Array.isArray(b[key]) ? b[key] : [])])].sort().slice(-200)]));
  } else if (docKey === StorageKeys.repertoires.key) merged = mergeRepertoire(local, remote);
  else if (docKey === StorageKeys.gameLibrary.key) merged = mergeGameLibrary(local, remote);
  else if (
    docKey === StorageKeys.pgnCommentTranslations.key ||
    docKey === StorageKeys.pgnTranslationQueue.key ||
    docKey === StorageKeys.openingLineMastery.key ||
    docKey === StorageKeys.chessCultureFeedback.key
  ) {
    merged = mergeKeyedRecords(local, remote);
  } else if (docKey === StorageKeys.chessCultureHistory.key) {
    merged = mergeHistoryList(local, remote);
  } else if (isRecordDocumentKey(docKey)) {
    merged = mergeRecordDocument(local, remote);
  } else if (docKey === StorageKeys.userPreferences.key) {
    merged = mergeUserPreferences(local, remote);
  } else if (docKey === StorageKeys.endgameTrainingV2.key) {
    merged = mergeEndgameTrainingDocuments(local, remote, (positionId) => {
      const pos = getPositionById(positionId);
      return pos ? { fen: pos.fen, defender: pos.defender } : null;
    });
  } else if (docKey === StorageKeys.theoreticalEndgameV2.key) {
    merged = mergeTheoreticalDocuments(local, remote);
  } else {
    merged = lastWriteWins(local, remote);
  }
  return merged == null ? localRaw : JSON.stringify(merged);
}

export function markDeletedIds(raw: string | null, ids: string[]): string | null {
  if (!raw || ids.length === 0) return raw;
  const parsed = asRecord(parseJson(raw));
  if (!parsed) return raw;
  const prev = new Set([...((parsed.syncDeletedIds as string[]) ?? []), ...ids]);
  return JSON.stringify({ ...parsed, syncDeletedIds: [...prev] });
}
