/**
 * Serialize a ReaderGame (+ original headers) back to PGN.
 * Preserves main line, variations, comments before/after, and NAGs.
 */
import type { ReaderGame, ReaderNode } from '../gameReader/types.ts';

function escapeHeader(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sanitizeComment(text: string): string {
  return text.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

function formatNag(nag: string): string {
  const trimmed = nag.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('$') ? trimmed : `$${trimmed}`;
}

const HEADER_ORDER = [
  'Event',
  'Site',
  'Date',
  'Round',
  'White',
  'Black',
  'Result',
  'ECO',
  'Opening',
  'Variation',
];

export function serializeOpeningPgn(
  headers: Record<string, string>,
  game: ReaderGame,
): string {
  const merged: Record<string, string> = {
    Event: 'AnyChess Opening Study',
    Site: 'AnyChess',
    Result: '*',
    ...headers,
  };
  if (!merged.Result) merged.Result = '*';

  const lines: string[] = [];
  const seen = new Set<string>();
  for (const key of HEADER_ORDER) {
    const val = merged[key];
    if (val != null && val !== '') {
      lines.push(`[${key} "${escapeHeader(val)}"]`);
      seen.add(key);
    }
  }
  for (const [key, val] of Object.entries(merged)) {
    if (seen.has(key) || val == null || val === '') continue;
    lines.push(`[${key} "${escapeHeader(val)}"]`);
  }
  lines.push('');

  const parts: string[] = [];
  writeChildren(game, game.rootIds, parts, true);
  parts.push(merged.Result || '*');
  lines.push(parts.join(' ').replace(/\s+\(/g, ' (').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')'));
  lines.push('');
  return lines.join('\n');
}

function writeChildren(
  game: ReaderGame,
  childIds: string[],
  parts: string[],
  forceNumber: boolean,
): void {
  if (childIds.length === 0) return;
  const main = game.nodesById[childIds[0]!];
  if (!main) return;
  emitNode(main, forceNumber, parts);
  const hadVariations = childIds.length > 1;
  for (let i = 1; i < childIds.length; i += 1) {
    const side = game.nodesById[childIds[i]!];
    if (!side) continue;
    parts.push('(');
    emitNode(side, true, parts);
    writeChildren(game, side.childIds, parts, false);
    parts.push(')');
  }
  writeChildren(game, main.childIds, parts, hadVariations);
}

function emitNode(node: ReaderNode, numbered: boolean, parts: string[]): void {
  const before = node.commentBefore?.trim();
  if (before) parts.push(`{${sanitizeComment(before)}}`);
  if (numbered || node.color === 'white') {
    parts.push(node.color === 'white' ? `${node.moveNumber}.` : `${node.moveNumber}...`);
  }
  parts.push(node.san);
  for (const nag of node.nags ?? []) {
    const formatted = formatNag(nag);
    if (formatted) parts.push(formatted);
  }
  const after = node.comment?.trim();
  if (after) parts.push(`{${sanitizeComment(after)}}`);
}
