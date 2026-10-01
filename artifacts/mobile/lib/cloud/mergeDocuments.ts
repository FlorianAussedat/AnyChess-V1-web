import { StorageKeys } from '../storage/StorageKeys.ts';

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

function timestampOf(item: { updatedAt?: string; importedAt?: string; createdAt?: string }): string {
  return item.updatedAt || item.importedAt || item.createdAt || '';
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
  const files = mergeById(filesLeft, filesRight, deleted, (x, y) =>
    timestampOf(x) >= timestampOf(y) ? x : y,
  );
  const seen = new Set<string>();
  const deduped = files.filter((file) => {
    const fingerprint = `${file.filename ?? ''}\n${file.pgnText ?? ''}`;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
  return {
    ...a,
    ...b,
    version: 2,
    folders,
    files: deduped,
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
  const games = mergeById(
    (Array.isArray(a.games) ? a.games : []) as {
      id: string;
      fingerprint?: string;
      updatedAt?: string;
      importedAt?: string;
    }[],
    (Array.isArray(b.games) ? b.games : []) as {
      id: string;
      fingerprint?: string;
      updatedAt?: string;
      importedAt?: string;
    }[],
    deleted,
    (x, y) => (timestampOf(x) >= timestampOf(y) ? x : y),
  );
  const seen = new Set<string>();
  const deduped = games.filter((game) => {
    const mark = game.fingerprint || game.id;
    if (seen.has(mark)) return false;
    seen.add(mark);
    return true;
  });
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

function mergeKeyedRecords(local: unknown, remote: unknown): unknown {
  const a = asRecord(local);
  const b = asRecord(remote);
  if (!a) return b;
  if (!b) return a;
  const deleted = deletedIdSet(a, b);
  const records = dropDeletedKeys(
    {
      ...((a.records as Record<string, unknown>) ?? {}),
      ...((b.records as Record<string, unknown>) ?? {}),
    },
    deleted,
  );
  if (a.records || b.records) {
    return { ...a, ...b, records, syncDeletedIds: [...deleted] };
  }
  const lines = dropDeletedKeys(
    {
      ...((a.lines as Record<string, unknown>) ?? {}),
      ...((b.lines as Record<string, unknown>) ?? {}),
    },
    deleted,
  );
  if (a.lines || b.lines) {
    return { ...a, ...b, lines, syncDeletedIds: [...deleted] };
  }
  const jobs = dropDeletedKeys(
    {
      ...((a.jobs as Record<string, unknown>) ?? {}),
      ...((b.jobs as Record<string, unknown>) ?? {}),
    },
    deleted,
  );
  if (a.jobs || b.jobs) {
    return { ...a, ...b, jobs, syncDeletedIds: [...deleted] };
  }
  const questions = dropDeletedKeys(
    {
      ...((a.questions as Record<string, unknown>) ?? {}),
      ...((b.questions as Record<string, unknown>) ?? {}),
    },
    deleted,
  );
  if (a.questions || b.questions) {
    return { ...a, ...b, questions, syncDeletedIds: [...deleted] };
  }
  return lastWriteWins(a, b);
}

function lastWriteWins(local: unknown, remote: unknown): unknown {
  const a = asRecord(local);
  const b = asRecord(remote);
  if (!a) return b;
  if (!b) return a;
  const aAt = typeof a.updatedAt === 'string' ? a.updatedAt : '';
  const bAt = typeof b.updatedAt === 'string' ? b.updatedAt : '';
  return aAt >= bAt ? { ...b, ...a, updatedAt: newerIso(aAt, bAt) } : { ...a, ...b, updatedAt: newerIso(aAt, bAt) };
}

function mergeBestScores(local: unknown, remote: unknown): unknown {
  const a = asRecord(local);
  const b = asRecord(remote);
  if (!a) return b;
  if (!b) return a;
  const out: Record<string, unknown> = { ...a, ...b };
  for (const key of Object.keys({ ...a, ...b })) {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') out[key] = Math.max(av, bv);
  }
  if (a.bestByDifficulty || b.bestByDifficulty) {
    const left = (a.bestByDifficulty ?? {}) as Record<string, number>;
    const right = (b.bestByDifficulty ?? {}) as Record<string, number>;
    const merged: Record<string, number> = { ...left };
    for (const [key, value] of Object.entries(right)) {
      merged[key] = Math.max(merged[key] ?? 0, value);
    }
    out.bestByDifficulty = merged;
  }
  return out;
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
  if (docKey === StorageKeys.repertoires.key) merged = mergeRepertoire(local, remote);
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
  } else if (
    docKey === StorageKeys.openingQuizRecords.key ||
    docKey === StorageKeys.moveNamingSession60.key ||
    docKey === StorageKeys.playMoveSession60.key ||
    docKey === StorageKeys.blindMemoryRecords.key
  ) {
    merged = mergeBestScores(local, remote);
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
