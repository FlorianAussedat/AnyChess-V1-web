/**
 * Shared legal / structural validators for theoretical endgame positions.
 * Used by build, validate, and unit tests.
 */
import { Chess } from 'chess.js';

export type PieceMap = {
  K: number;
  Q: number;
  R: number;
  B: number;
  N: number;
  P: number;
  k: number;
  q: number;
  r: number;
  b: number;
  n: number;
  p: number;
};

export function parsePieceCounts(fen: string): PieceMap {
  const counts: PieceMap = {
    K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0,
    k: 0, q: 0, r: 0, b: 0, n: 0, p: 0,
  };
  const board = fen.split(' ')[0] ?? '';
  for (const ch of board) {
    if (ch in counts) counts[ch as keyof PieceMap] += 1;
  }
  return counts;
}

export function countPieces(fen: string): number {
  return (fen.split(' ')[0] ?? '').replace(/[^KQRBNPqkrbnp]/g, '').length;
}

export function readablePieces(fen: string): string {
  const c = parsePieceCounts(fen);
  const white: string[] = [];
  const black: string[] = [];
  const push = (side: string[], n: number, name: string) => {
    if (n <= 0) return;
    side.push(n === 1 ? name : `${n}×${name}`);
  };
  push(white, c.K, 'K');
  push(white, c.Q, 'Q');
  push(white, c.R, 'R');
  push(white, c.B, 'B');
  push(white, c.N, 'N');
  push(white, c.P, 'P');
  push(black, c.k, 'k');
  push(black, c.q, 'q');
  push(black, c.r, 'r');
  push(black, c.b, 'b');
  push(black, c.n, 'n');
  push(black, c.p, 'p');
  return `White: ${white.join(' ') || '—'} · Black: ${black.join(' ') || '—'}`;
}

function findKingSquare(game: Chess, color: 'w' | 'b'): string | null {
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r]?.[c];
      if (p && p.type === 'k' && p.color === color) {
        return `${String.fromCharCode(97 + c)}${8 - r}`;
      }
    }
  }
  return null;
}

function kingsAdjacent(a: string, b: string): boolean {
  const af = a.charCodeAt(0) - 97;
  const ar = Number(a[1]);
  const bf = b.charCodeAt(0) - 97;
  const br = Number(b[1]);
  return Math.max(Math.abs(af - bf), Math.abs(ar - br)) <= 1;
}

export type FenLegalityResult = {
  ok: boolean;
  errors: string[];
  whiteKingInCheck: boolean;
  blackKingInCheck: boolean;
  sideToMove: 'w' | 'b';
  legalMoveCount: number;
  pieceCount: number;
};

/**
 * Strict FEN legality. A check against the side that is NOT to move is illegal.
 * The side to move may be in check, as long as the position is not mate or stalemate.
 */
export function validateFenLegality(fen: string): FenLegalityResult {
  const errors: string[] = [];
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch (e) {
    return {
      ok: false,
      errors: [`illegal FEN: ${(e as Error).message}`],
      whiteKingInCheck: false,
      blackKingInCheck: false,
      sideToMove: 'w',
      legalMoveCount: 0,
      pieceCount: 0,
    };
  }

  const counts = parsePieceCounts(fen);
  if (counts.K !== 1) errors.push(`expected exactly 1 white king, found ${counts.K}`);
  if (counts.k !== 1) errors.push(`expected exactly 1 black king, found ${counts.k}`);

  const wk = findKingSquare(game, 'w');
  const bk = findKingSquare(game, 'b');
  if (!wk || !bk) {
    errors.push('missing king square');
    return {
      ok: false,
      errors,
      whiteKingInCheck: false,
      blackKingInCheck: false,
      sideToMove: game.turn(),
      legalMoveCount: 0,
      pieceCount: countPieces(fen),
    };
  }

  if (kingsAdjacent(wk, bk)) errors.push('kings are adjacent');

  // Pawns on 1st / 8th
  const placement = fen.split(' ')[0] ?? '';
  const ranks = placement.split('/');
  if (/[Pp]/.test(ranks[0] ?? '') || /[Pp]/.test(ranks[7] ?? '')) {
    errors.push('pawn on first or eighth rank');
  }

  const whiteKingInCheck = game.isAttacked(wk as never, 'b');
  const blackKingInCheck = game.isAttacked(bk as never, 'w');
  const stm = game.turn();
  if (stm === 'w' && blackKingInCheck) {
    errors.push('black king is in check while White is to move');
  }
  if (stm === 'b' && whiteKingInCheck) {
    errors.push('white king is in check while Black is to move');
  }

  if (game.isGameOver()) errors.push('position is already terminal');

  const legalMoveCount = game.moves().length;
  if (legalMoveCount === 0) errors.push('no legal moves for side to move');

  // Castling / ep fields — chess.js already rejects most illegal combinations on load.
  const parts = fen.split(' ');
  if (parts.length < 4) errors.push('FEN must have at least 4 fields');

  return {
    ok: errors.length === 0,
    errors,
    whiteKingInCheck,
    blackKingInCheck,
    sideToMove: game.turn(),
    legalMoveCount,
    pieceCount: countPieces(fen),
  };
}

function rookPawnFile(fen: string): boolean {
  try {
    const game = new Chess(fen);
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r]?.[f];
        if (p?.type === 'p' && (f === 0 || f === 7)) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export type ThemeMaterialResult = { ok: boolean; errors: string[] };

export function validateThemeMaterial(
  themeId: string,
  fen: string,
): ThemeMaterialResult {
  const c = parsePieceCounts(fen);
  const errors: string[] = [];
  const total =
    c.K + c.Q + c.R + c.B + c.N + c.P + c.k + c.q + c.r + c.b + c.n + c.p;

  switch (themeId) {
    case 'queen-mate':
      if (!(c.K === 1 && c.k === 1 && c.Q + c.q === 1 && total === 3)) {
        errors.push('queen-mate requires KQ vs K, either side');
      }
      break;
    case 'rook-mate':
      if (!(c.K === 1 && c.k === 1 && c.R + c.r === 1 && total === 3)) {
        errors.push('rook-mate requires KR vs K, either side');
      }
      break;
    case 'two-bishops-mate':
      if (!(c.K === 1 && c.k === 1 && c.B + c.b === 2 && total === 4)) {
        errors.push('two-bishops-mate requires KBB vs K, either side');
      } else {
        const game = new Chess(fen);
        const squares: { file: number; rank: number }[] = [];
        const board = game.board();
        for (let r = 0; r < 8; r++) {
          for (let f = 0; f < 8; f++) {
            const p = board[r]?.[f];
            if (p && p.type === 'b') squares.push({ file: f, rank: 8 - r });
          }
        }
        if (squares.length === 2) {
          const color0 = (squares[0]!.file + squares[0]!.rank) % 2;
          const color1 = (squares[1]!.file + squares[1]!.rank) % 2;
          if (color0 === color1) {
            errors.push('two bishops must be on opposite colors');
          }
        }
      }
      break;
    case 'pawn-square':
    case 'opposition':
    case 'kp-vs-k':
    case 'key-squares':
      if (!(c.K === 1 && c.k === 1 && c.P + c.p === 1 && total === 3)) {
        errors.push(`${themeId} requires KPK material, either side`);
      }
      break;
    case 'rook-pawn': {
      if (!(c.K === 1 && c.k === 1 && c.P + c.p === 1 && total === 3)) {
        errors.push('rook-pawn requires KPK material');
      } else if (!rookPawnFile(fen)) {
        errors.push('rook-pawn requires the pawn on the a- or h-file');
      }
      break;
    }
    case 'pawn-race':
      if (!(c.K === 1 && c.P >= 1 && c.k === 1 && c.p >= 1 && total === 4)) {
        errors.push('pawn-race requires K+P vs k+p');
      }
      break;
    case 'pawn-breakthrough':
      if (!(c.K === 1 && c.P === 3 && c.k === 1 && c.p === 3 && total === 8)) {
        errors.push('pawn-breakthrough requires KPPP vs kppp');
      }
      break;
    case 'lucena':
      if (!(c.K === 1 && c.R === 1 && c.P === 1 && c.k === 1 && c.r === 1 && total === 5)) {
        errors.push('lucena requires KRPKR material');
      } else {
        // Structural: attacking pawn on 7th, attacking king on 8th (promotion file)
        const game = new Chess(fen);
        const board = game.board();
        let pawnFile = -1;
        let pawnRank = -1;
        let attKingFile = -1;
        let attKingRank = -1;
        for (let r = 0; r < 8; r++) {
          for (let f = 0; f < 8; f++) {
            const p = board[r]?.[f];
            if (!p || p.color !== 'w') continue;
            if (p.type === 'p') {
              pawnFile = f;
              pawnRank = 8 - r;
            }
            if (p.type === 'k') {
              attKingFile = f;
              attKingRank = 8 - r;
            }
          }
        }
        if (pawnRank !== 7) errors.push('lucena: attacking pawn must be on the 7th rank');
        if (pawnFile === 0 || pawnFile === 7) {
          errors.push('lucena: pawn must not be a rook pawn');
        }
        if (attKingRank !== 8 || attKingFile !== pawnFile) {
          errors.push('lucena: attacking king must stand on the promotion square');
        }
      }
      break;
    case 'philidor':
    case 'lateral-checks':
      if (
        !(
          c.K === 1 &&
          c.k === 1 &&
          c.R === 1 &&
          c.r === 1 &&
          c.P + c.p === 1 &&
          total === 5
        )
      ) {
        errors.push(`${themeId} requires KRPKR material`);
      }
      break;
    case 'outside-passed':
      if (!(c.P + c.p >= 3 && c.K === 1 && c.k === 1 && total === c.K + c.k + c.P + c.p)) {
        errors.push('outside-passed requires kings and at least three pawns, no other pieces');
      }
      break;
    case 'triangulation':
      if (!(c.P + c.p >= 2 && c.K === 1 && c.k === 1 && total === c.K + c.k + c.P + c.p)) {
        errors.push('triangulation requires a pure pawn ending');
      }
      break;
    case 'bad-bishop': {
      const bishops = c.B + c.b;
      const pawns = c.P + c.p;
      if (!(bishops === 1 && pawns === 1 && c.K === 1 && c.k === 1 && total === 4)) {
        errors.push('bad-bishop requires KBP vs K');
      }
      break;
    }
    case 'queen-vs-pawn': {
      const queens = c.Q + c.q;
      const pawns = c.P + c.p;
      if (!(queens === 1 && pawns === 1 && c.K === 1 && c.k === 1 && total === 4)) {
        errors.push('queen-vs-pawn requires KQ vs KP');
      }
      break;
    }
    case 'vancura':
      if (
        !(
          c.K === 1 &&
          c.k === 1 &&
          c.R === 1 &&
          c.r === 1 &&
          c.P + c.p === 1 &&
          total === 5
        )
      ) {
        errors.push('vancura requires KRPKR material');
      } else if (!rookPawnFile(fen)) {
        errors.push('vancura requires a rook pawn');
      }
      break;
    default:
      errors.push(`unknown themeId: ${themeId}`);
  }

  return { ok: errors.length === 0, errors };
}

/** Legacy TE-NNN ids from the 44-position pool — must never reappear. */
export const LEGACY_THEORETICAL_IDS: readonly string[] = Array.from(
  { length: 44 },
  (_, i) => `TE-${String(i + 1).padStart(3, '0')}`,
);

export const REMOVED_THEME_IDS = ['three-pawns'] as const;
