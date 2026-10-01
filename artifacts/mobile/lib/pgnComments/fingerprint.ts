export function normalizeCommentText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Portable FNV-1a — no Node crypto (React Native). */
export function isEchoTranslation(original: string, translated: string): boolean {
  if (!translated.trim()) return true;
  return fingerprintComment(original) === fingerprintComment(translated);
}

export function fingerprintComment(text: string): string {
  const normalized = normalizeCommentText(text);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}_${normalized.length}`;
}

export function translationRecordId(
  fileId: string,
  gameIndex: number,
  nodeId: string,
  slot: string,
): string {
  return `${fileId}:${gameIndex}:${nodeId}:${slot}`;
}
