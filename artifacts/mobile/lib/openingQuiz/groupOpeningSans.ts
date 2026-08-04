/**
 * Group opening-line SAN plies into numbered White/Black rows for quiz display.
 * Reuses pairMoveHistory for pairing; exposes optional black when the line ends
 * on a White move.
 */
import { pairMoveHistory } from '../game/pairMoveHistory.ts';

export type OpeningMoveRow = {
  moveNumber: number;
  white?: string;
  black?: string;
};

/** Pair half-moves into full-move rows without mutating SAN strings. */
export function groupOpeningSans(sans: readonly string[]): OpeningMoveRow[] {
  return pairMoveHistory([...sans]).map((row) => {
    const out: OpeningMoveRow = { moveNumber: row.num };
    if (row.white) out.white = row.white;
    if (row.black) out.black = row.black;
    return out;
  });
}
