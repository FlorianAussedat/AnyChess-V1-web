import type { MoveRow } from './types.ts';

function startMoveNumber(startFen?: string): number {
  const n = Number(startFen?.trim().split(/\s+/)[5]);
  return n > 0 ? n : 1;
}

function blackMovesFirst(startFen?: string): boolean {
  return startFen?.trim().split(/\s+/)[1] === 'b';
}

/** Pair SAN half-moves into numbered rows for the move-list UI. */
export function pairMoveHistory(history: string[], startFen?: string): MoveRow[] {
  const rows: MoveRow[] = [];
  const startNum = startMoveNumber(startFen);
  if (blackMovesFirst(startFen)) {
    if (history.length === 0) return rows;
    rows.push({
      key: '0',
      num: startNum,
      white: '',
      black: history[0] ?? '',
    });
    for (let i = 1; i < history.length; i += 2) {
      rows.push({
        key: String(i),
        num: startNum + Math.ceil(i / 2),
        white: history[i] ?? '',
        black: history[i + 1] ?? '',
      });
    }
    return rows;
  }

  for (let i = 0; i < history.length; i += 2) {
    rows.push({
      key: String(i),
      num: startNum + Math.floor(i / 2),
      white: history[i] ?? '',
      black: history[i + 1] ?? '',
    });
  }
  return rows;
}
