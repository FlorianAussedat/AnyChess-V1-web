import { Chess } from 'chess.js';

/** Normalize FEN for dedup (board + stm + castling + ep). */
export function normalizeFenKey(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  return parts.slice(0, 4).join(' ');
}

export function pieceCount(fen: string): number {
  return new Chess(fen).board().flat().filter(Boolean).length;
}

export function squareToCoord(file: number, rank: number): string {
  return `${String.fromCharCode(97 + file)}${rank + 1}`;
}

export function tryBuildFen(
  pieces: Array<{ type: string; color: 'w' | 'b'; file: number; rank: number }>,
  stm: 'w' | 'b',
): string | null {
  const board: (null | { type: string; color: 'w' | 'b' })[][] = Array.from(
    { length: 8 },
    () => Array.from({ length: 8 }, () => null),
  );
  for (const p of pieces) {
    if (p.file < 0 || p.file > 7 || p.rank < 0 || p.rank > 7) return null;
    if (board[p.rank]![p.file]) return null;
    board[p.rank]![p.file] = { type: p.type, color: p.color };
  }
  const rows = board
    .slice()
    .reverse()
    .map((row) => {
      let s = '';
      let empty = 0;
      for (const cell of row) {
        if (!cell) {
          empty += 1;
        } else {
          if (empty > 0) {
            s += String(empty);
            empty = 0;
          }
          const ch =
            cell.type === 'p'
              ? 'p'
              : cell.type === 'n'
                ? 'n'
                : cell.type === 'b'
                  ? 'b'
                  : cell.type === 'r'
                    ? 'r'
                    : cell.type === 'q'
                      ? 'q'
                      : 'k';
          s += cell.color === 'w' ? ch.toUpperCase() : ch;
        }
      }
      if (empty > 0) s += String(empty);
      return s || '8';
    });
  const fen = `${rows.join('/')}` + ` ${stm} - - 0 1`;
  try {
    const g = new Chess(fen);
    if (g.isGameOver()) return null;
    return g.fen();
  } catch {
    return null;
  }
}

export function kingsTooClose(
  wk: { file: number; rank: number },
  bk: { file: number; rank: number },
): boolean {
  return Math.max(Math.abs(wk.file - bk.file), Math.abs(wk.rank - bk.rank)) <= 1;
}
