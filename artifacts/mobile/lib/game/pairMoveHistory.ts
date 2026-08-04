import type { MoveRow } from './types.ts';

/** Pair SAN half-moves into numbered rows for the move-list UI. */
export function pairMoveHistory(history: string[]): MoveRow[] {
  const rows: MoveRow[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({
      key: String(i),
      num: Math.floor(i / 2) + 1,
      white: history[i] ?? '',
      black: history[i + 1] ?? '',
    });
  }
  return rows;
}
