/**
 * Stable name of the line actually selected for Review / Learning play.
 * Never invents a variation from the board; only uses stored path labels,
 * PGN headers, then the file name.
 */
import { getOpeningDisplayName } from '../openings/openingDisplayName.ts';

const GENERIC_LINE_NAME = /^(anychess line|ligne)$/i;

export function isGenericReviewLineName(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? '';
  return trimmed.length === 0 || GENERIC_LINE_NAME.test(trimmed);
}

export function sourceLabelFromPgnHeaders(
  headers: Record<string, string> | null | undefined,
): string | undefined {
  if (!headers) return undefined;
  const named = getOpeningDisplayName({ headers });
  if (named && !isGenericReviewLineName(named)) return named;
  const event = headers.Event?.trim();
  if (event && !isGenericReviewLineName(event)) return event;
  return undefined;
}

export function reviewLineDisplayName(input: {
  pathLabel?: string | null;
  headers?: Record<string, string> | null;
  fileDisplayName?: string | null;
}): string {
  const stored = input.pathLabel?.trim();
  if (stored && !isGenericReviewLineName(stored)) return stored;

  const fromHeaders = sourceLabelFromPgnHeaders(input.headers);
  if (fromHeaders) return fromHeaders;

  const fromMeta = getOpeningDisplayName({
    headers: input.headers,
    sourceLabel: stored,
  });
  if (fromMeta && !isGenericReviewLineName(fromMeta)) return fromMeta;

  const file = input.fileDisplayName?.trim();
  if (file && !isGenericReviewLineName(file)) return file;

  if (stored) return stored;
  if (fromMeta) return fromMeta;
  return file ?? '';
}
