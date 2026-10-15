/**
 * Generation stamps for personal records.
 * A reset is a stored document, not a deleted key: sync must not treat
 * "nothing locally" as "take the cloud copy".
 * Scores count only when they were earned at or after the latest reset.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';

export type ScoreDoc = Record<string, unknown>;

const BEST_MAPS = ['bestByDifficulty', 'bestByBand'] as const;
const LATEST_MAPS = ['currentByBand'] as const;

function iso(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function later(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function asDoc(value: unknown): ScoreDoc | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as ScoreDoc;
}

function asMap(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function stringMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(asMap(value))) {
    if (typeof entry === 'string' && entry) out[key] = entry;
  }
  return out;
}

export async function readScoreDocument(
  storage: KeyValueStorage,
  key: string,
): Promise<ScoreDoc> {
  const raw = await storage.getItem(key);
  if (!raw) return {};
  try {
    return asDoc(JSON.parse(raw)) ?? {};
  } catch {
    return {};
  }
}

export function numberField(doc: ScoreDoc, field: string): number {
  return num(doc[field]);
}

export function mapField(doc: ScoreDoc, mapName: string, field: string): number {
  return num(asMap(doc[mapName])[field]);
}

export function stampScalar(doc: ScoreDoc, field: string, value: number, at: string): void {
  doc[field] = value;
  const scored = stringMap(doc.scoredAt);
  scored[field] = at;
  doc.scoredAt = scored;
  doc.updatedAt = at;
}

export function stampMapValue(
  doc: ScoreDoc,
  mapName: string,
  field: string,
  value: number,
  at: string,
): void {
  const bag = asMap(doc[mapName]);
  bag[field] = value;
  doc[mapName] = bag;
  const scored = stringMap(doc.scoredAt);
  scored[`${mapName}.${field}`] = at;
  doc.scoredAt = scored;
  doc.updatedAt = at;
}

/** Full reset. Older numeric scores in this document stop counting. */
export function resetScoreDocument(doc: ScoreDoc, at: string, scalars: string[], maps: string[]): void {
  doc.resetAt = at;
  doc.updatedAt = at;
  const scored = stringMap(doc.scoredAt);
  for (const field of scalars) {
    doc[field] = 0;
    scored[field] = at;
  }
  for (const mapName of maps) {
    const bag = asMap(doc[mapName]);
    for (const field of Object.keys(bag)) {
      bag[field] = 0;
      scored[`${mapName}.${field}`] = at;
    }
    doc[mapName] = bag;
  }
  doc.scoredAt = scored;
}

export function resetScoreField(doc: ScoreDoc, field: string, at: string): void {
  const marks = stringMap(doc.fieldResetAt);
  marks[field] = at;
  doc.fieldResetAt = marks;
  if (field.includes('.')) {
    const dot = field.indexOf('.');
    const mapName = field.slice(0, dot);
    const inner = field.slice(dot + 1);
    const bag = asMap(doc[mapName]);
    bag[inner] = 0;
    doc[mapName] = bag;
  } else {
    doc[field] = 0;
  }
  const scored = stringMap(doc.scoredAt);
  scored[field] = at;
  doc.scoredAt = scored;
  doc.updatedAt = at;
}

function survives(
  value: number,
  scoredAt: string,
  docResetAt: string,
  fieldResetAt: string,
  cutoff: string,
): number {
  if (!cutoff) return value;
  if (scoredAt) return scoredAt >= cutoff ? value : 0;
  const born = later(docResetAt, fieldResetAt);
  if (born && born >= cutoff) return value;
  return 0;
}

/**
 * Highest score inside the latest reset generation.
 * A number without a timestamp is legacy and loses to any reset.
 * `currentByBand` keeps the later stamp instead of the larger streak.
 */
export function mergeRecordDocument(local: unknown, remote: unknown): unknown {
  const a = asDoc(local);
  const b = asDoc(remote);
  if (!a) return b;
  if (!b) return a;

  const aReset = iso(a.resetAt);
  const bReset = iso(b.resetAt);
  const resetAt = later(aReset, bReset);
  const aFieldReset = stringMap(a.fieldResetAt);
  const bFieldReset = stringMap(b.fieldResetAt);
  const aScored = stringMap(a.scoredAt);
  const bScored = stringMap(b.scoredAt);
  const fieldResetAt: Record<string, string> = {};
  const scoredAt: Record<string, string> = {};
  const out: ScoreDoc = {};

  const cutoffFor = (field: string) =>
    later(later(resetAt, aFieldReset[field] ?? ''), bFieldReset[field] ?? '');

  const consider = (field: string, aVal: unknown, bVal: unknown, latest: boolean) => {
    const cutoff = cutoffFor(field);
    const left = survives(num(aVal), aScored[field] ?? '', aReset, aFieldReset[field] ?? '', cutoff);
    const right = survives(num(bVal), bScored[field] ?? '', bReset, bFieldReset[field] ?? '', cutoff);
    const leftAt = aScored[field] || iso(a.updatedAt);
    const rightAt = bScored[field] || iso(b.updatedAt);
    let chosen = Math.max(left, right);
    let chosenAt = left >= right ? leftAt : rightAt;
    if (latest && leftAt !== rightAt) {
      const leftWins = leftAt >= rightAt;
      chosen = leftWins ? left : right;
      chosenAt = leftWins ? leftAt : rightAt;
    }
    if (chosen > 0 || cutoff) {
      if (chosenAt) scoredAt[field] = chosen > 0 ? chosenAt : cutoff;
    }
    const mark = later(aFieldReset[field] ?? '', bFieldReset[field] ?? '');
    if (mark) fieldResetAt[field] = mark;
    return chosen;
  };

  const scalars = new Set<string>();
  for (const source of [a, b]) {
    for (const key of ['best', 'listenReconstruct', 'watchRecite']) {
      if (typeof source[key] === 'number') scalars.add(key);
    }
  }
  for (const field of scalars) {
    out[field] = consider(field, a[field], b[field], false);
  }

  for (const mapName of [...BEST_MAPS, ...LATEST_MAPS]) {
    const left = asMap(a[mapName]);
    const right = asMap(b[mapName]);
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    if (keys.size === 0) continue;
    const merged: Record<string, number> = {};
    for (const key of keys) {
      const field = `${mapName}.${key}`;
      const value = consider(
        field,
        left[key],
        right[key],
        (LATEST_MAPS as readonly string[]).includes(mapName),
      );
      if (value > 0 || cutoffFor(field)) merged[key] = value;
    }
    if (Object.keys(merged).length > 0) out[mapName] = merged;
  }

  if (resetAt) out.resetAt = resetAt;
  if (Object.keys(fieldResetAt).length > 0) out.fieldResetAt = fieldResetAt;
  if (Object.keys(scoredAt).length > 0) out.scoredAt = scoredAt;
  const updatedAt = later(iso(a.updatedAt), iso(b.updatedAt));
  if (updatedAt) out.updatedAt = updatedAt;
  return out;
}

export async function updateScoreDocument(
  storage: KeyValueStorage,
  key: string,
  mutate: (doc: ScoreDoc) => void,
  hooks?: { afterRead?: () => Promise<void> },
): Promise<ScoreDoc> {
  if (hooks?.afterRead) {
    await readScoreDocument(storage, key);
    await hooks.afterRead();
  }
  const doc = await readScoreDocument(storage, key);
  const before = JSON.stringify(doc);
  mutate(doc);
  const written = JSON.stringify(doc);
  if (written === before) return doc;
  await storage.setItem(key, written);
  const afterRaw = await storage.getItem(key);
  if (afterRaw && afterRaw !== written) {
    let after: ScoreDoc = {};
    try {
      after = asDoc(JSON.parse(afterRaw)) ?? {};
    } catch {
      after = {};
    }
    const repaired = asDoc(mergeRecordDocument(after, doc)) ?? doc;
    await storage.setItem(key, JSON.stringify(repaired));
    return repaired;
  }
  return doc;
}
