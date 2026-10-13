/**
 * Exact mate distance for elementary material, built in memory.
 *
 * The catalog Syzygy distance covers only the initial FEN. These tables
 * cover every legal position of the same material, so a later decision can
 * still be graded exactly. Families that are too large to build here are
 * left out; `studyElementaryTables` reports that cost before any of them
 * is enabled.
 */
const UNKNOWN = 255;
const NOT_WIN = 254;

const FILE_OF = (sq: number) => sq & 7;
const RANK_OF = (sq: number) => sq >> 3;

type Family = 'kqk' | 'krk' | 'kpk';

export type ElementaryStudy = {
  family: Family | 'kbbk';
  enabled: boolean;
  positions: number;
  bytes: number;
  buildMs: number;
  maxDtm: number | null;
  note: string;
};

/**
 * None of the retrograde tables are enabled. A corner queen position
 * (`k7/8/8/8/8/8/8/K6Q w`) is not mate in one, and the builder reports 1.
 * Shipping that distance would invent a score. See EXACT_EVAL.md.
 */
const ENABLED = new Set<Family>();

const tables = new Map<Family, Uint8Array>();
let kpkDependsOnKqk = false;

function kingsTouch(a: number, b: number): boolean {
  const df = Math.abs(FILE_OF(a) - FILE_OF(b));
  const dr = Math.abs(RANK_OF(a) - RANK_OF(b));
  return a !== b && df <= 1 && dr <= 1;
}

function ray(from: number, df: number, dr: number, block: (sq: number) => boolean, onHit: (sq: number) => void): void {
  let file = FILE_OF(from);
  let rank = RANK_OF(from);
  while (true) {
    file += df;
    rank += dr;
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return;
    const sq = (rank << 3) | file;
    if (block(sq)) {
      onHit(sq);
      return;
    }
    onHit(sq);
  }
}

function queenAttacks(from: number, target: number, occupied: (sq: number) => boolean): boolean {
  const df = FILE_OF(target) - FILE_OF(from);
  const dr = RANK_OF(target) - RANK_OF(from);
  if (df !== 0 && dr !== 0 && Math.abs(df) !== Math.abs(dr)) return false;
  if (df === 0 && dr === 0) return false;
  const stepF = Math.sign(df);
  const stepR = Math.sign(dr);
  let file = FILE_OF(from) + stepF;
  let rank = RANK_OF(from) + stepR;
  while (file !== FILE_OF(target) || rank !== RANK_OF(target)) {
    if (occupied((rank << 3) | file)) return false;
    file += stepF;
    rank += stepR;
  }
  return true;
}

function rookAttacks(from: number, target: number, occupied: (sq: number) => boolean): boolean {
  if (FILE_OF(from) !== FILE_OF(target) && RANK_OF(from) !== RANK_OF(target)) return false;
  return queenAttacks(from, target, occupied);
}

const KING_STEPS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function kingTargets(from: number, into: (sq: number) => void): void {
  const file = FILE_OF(from);
  const rank = RANK_OF(from);
  for (const [df, dr] of KING_STEPS) {
    const nf = file + df;
    const nr = rank + dr;
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
    into((nr << 3) | nf);
  }
}

function buildKqkOrKrk(kind: 'kqk' | 'krk'): { table: Uint8Array; maxDtm: number } {
  const size = 64 * 64 * 64 * 2;
  const table = new Uint8Array(size);
  table.fill(UNKNOWN);
  const remaining = new Uint8Array(size);
  const worst = new Uint16Array(size);
  const index = (wk: number, bk: number, piece: number, stm: number) =>
    (((((wk << 6) | bk) << 6) | piece) << 1) | stm;

  const occupied = (wk: number, bk: number, piece: number, sq: number) =>
    sq === wk || sq === bk || sq === piece;

  const pieceAttacks = kind === 'kqk' ? queenAttacks : rookAttacks;

  const blackMoves = (wk: number, bk: number, piece: number, into: (sq: number) => void) => {
    kingTargets(bk, (to) => {
      if (to === wk || to === piece) return;
      if (kingsTouch(to, wk)) return;
      if (pieceAttacks(piece, to, (sq) => sq !== to && occupied(wk, bk, piece, sq))) return;
      into(to);
    });
  };

  const whiteMoves = (wk: number, bk: number, piece: number, into: (next: [number, number, number]) => void) => {
    kingTargets(wk, (to) => {
      if (to === bk || to === piece) return;
      if (kingsTouch(to, bk)) return;
      into([to, bk, piece]);
    });
    const slides: Array<readonly [number, number]> =
      kind === 'kqk'
        ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
        : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [df, dr] of slides) {
      ray(piece, df, dr, (sq) => sq === wk || sq === bk, (sq) => {
        if (sq !== wk && sq !== bk) into([wk, bk, sq]);
      });
    }
  };

  type Node = { wk: number; bk: number; piece: number; stm: number };
  const queue: Node[] = [];
  const push = (node: Node, dist: number) => {
    const at = index(node.wk, node.bk, node.piece, node.stm);
    if (table[at] !== UNKNOWN) return;
    table[at] = dist;
    queue.push(node);
  };

  for (let wk = 0; wk < 64; wk += 1) {
    for (let bk = 0; bk < 64; bk += 1) {
      if (wk === bk || kingsTouch(wk, bk)) continue;
      for (let piece = 0; piece < 64; piece += 1) {
        if (piece === wk || piece === bk) continue;
        let moves = 0;
        blackMoves(wk, bk, piece, () => {
          moves += 1;
        });
        const at = index(wk, bk, piece, 1);
        if (moves === 0) {
          const inCheck = pieceAttacks(piece, bk, (sq) => occupied(wk, bk, piece, sq));
          if (inCheck) push({ wk, bk, piece, stm: 1 }, 0);
          else table[at] = NOT_WIN;
        } else {
          remaining[at] = moves;
        }
      }
    }
  }

  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor]!
    cursor += 1;
    const dist = table[index(current.wk, current.bk, current.piece, current.stm)]!;
    if (current.stm === 1) {
      // Black just got mated or lost. White parents moved into this.
      whiteMoves(current.wk, current.bk, current.piece, () => {
        /* parents are generated by reversing below */
      });
      // Reverse of a black king move: we are in a black-to-move loss.
      // White moved to here, so parent has white to move and the white piece or king stepped.
      // Generate white reverse by looking at positions that white-move into this one:
    }
    if (current.stm === 0) {
      // White to move, known win. Black moved into it. Parent: black to move, black king stepped.
      kingTargets(current.bk, (from) => {
        if (from === current.wk || from === current.piece) return;
        if (kingsTouch(from, current.wk)) return;
        if (pieceAttacks(current.piece, from, (sq) => sq !== from && occupied(current.wk, from, current.piece, sq))) {
          return;
        }
        // The move from -> current.bk was legal. Parent index.
        const parent = index(current.wk, from, current.piece, 1);
        if (table[parent] === NOT_WIN || table[parent] === 0) return;
        if (remaining[parent] === 0) return;
        remaining[parent] -= 1;
        if (dist + 1 > worst[parent]!) worst[parent] = dist + 1;
        if (remaining[parent] === 0 && table[parent] === UNKNOWN) {
          push({ wk: current.wk, bk: from, piece: current.piece, stm: 1 }, worst[parent]!);
        }
      });
    } else {
      // Black to move, known. White moved into it.
      // Reverse white king move.
      kingTargets(current.wk, (from) => {
        if (from === current.bk || from === current.piece || kingsTouch(from, current.bk)) return;
        const parentAt = index(from, current.bk, current.piece, 0);
        if (table[parentAt] === UNKNOWN) {
          push({ wk: from, bk: current.bk, piece: current.piece, stm: 0 }, dist + 1);
        }
      });
      // Reverse white piece slide: piece came from `from` along a clear ray to current.piece.
      const slides: Array<readonly [number, number]> =
        kind === 'kqk'
          ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
          : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [df, dr] of slides) {
        ray(current.piece, df, dr, (sq) => sq === current.wk || sq === current.bk, (from) => {
          if (from === current.wk || from === current.bk) return;
          const parentAt = index(current.wk, current.bk, from, 0);
          if (table[parentAt] === UNKNOWN) {
            push({ wk: current.wk, bk: current.bk, piece: from, stm: 0 }, dist + 1);
          }
        });
      }
    }
  }

  let maxDtm = 0;
  for (let i = 0; i < table.length; i += 1) {
    const value = table[i]!;
    if (value !== UNKNOWN && value !== NOT_WIN && value > maxDtm) maxDtm = value;
  }
  return { table, maxDtm };
}

function ensureFamily(family: Family): Uint8Array {
  const existing = tables.get(family);
  if (existing) return existing;
  if (family === 'kpk' && !kpkDependsOnKqk) {
    ensureFamily('kqk');
    kpkDependsOnKqk = true;
  }
  if (family === 'kpk') {
    const built = buildKpk(tables.get('kqk')!);
    tables.set('kpk', built.table);
    return built.table;
  }
  const built = buildKqkOrKrk(family);
  tables.set(family, built.table);
  return built.table;
}

function buildKpk(kqk: Uint8Array): { table: Uint8Array; maxDtm: number } {
  // White pawn, squares of ranks 2–7 stored as 0..47 (rank 1..6).
  const pawnSq = (pawnIndex: number) => {
    const rank = 1 + Math.floor(pawnIndex / 8);
    const file = pawnIndex % 8;
    return (rank << 3) | file;
  };
  const size = 64 * 64 * 48 * 2;
  const table = new Uint8Array(size);
  table.fill(UNKNOWN);
  const remaining = new Uint8Array(size);
  const worst = new Uint16Array(size);
  const index = (wk: number, bk: number, pawnIndex: number, stm: number) =>
    (((((wk << 6) | bk) << 6) | pawnIndex) << 1) | (stm & 1);

  const kqkAt = (wk: number, bk: number, queen: number, stm: number) =>
    (((((wk << 6) | bk) << 6) | queen) << 1) | stm;

  const pawnForward = (pawn: number): number => pawn + 8;

  type Child =
    | { kind: 'kpk'; wk: number; bk: number; pawnIndex: number; stm: number }
    | { kind: 'kqk'; at: number };

  const whiteChildren = (wk: number, bk: number, pawn: number): Child[] => {
    const out: Child[] = [];
    kingTargets(wk, (to) => {
      if (to === bk || to === pawn || kingsTouch(to, bk)) return;
      out.push({ kind: 'kpk', wk: to, bk, pawnIndex: pawnIndexOf(pawn), stm: 1 });
    });
    const next = pawnForward(pawn);
    if (next < 64 && next !== wk && next !== bk && RANK_OF(pawn) < 7) {
      if (RANK_OF(next) === 7) {
        const at = kqkAt(wk, bk, next, 1);
        out.push({ kind: 'kqk', at });
      } else {
        out.push({ kind: 'kpk', wk, bk, pawnIndex: pawnIndexOf(next), stm: 1 });
      }
    }
    if (RANK_OF(pawn) === 1) {
      const mid = pawn + 8;
      const dbl = pawn + 16;
      if (mid !== wk && mid !== bk && dbl !== wk && dbl !== bk && dbl < 64) {
        out.push({ kind: 'kpk', wk, bk, pawnIndex: pawnIndexOf(dbl), stm: 1 });
      }
    }
    return out;
  };

  // Black moves and init are filled while scanning.
  for (let wk = 0; wk < 64; wk += 1) {
    for (let bk = 0; bk < 64; bk += 1) {
      if (wk === bk || kingsTouch(wk, bk)) continue;
      for (let pawnIndex = 0; pawnIndex < 48; pawnIndex += 1) {
        const pawn = pawnSq(pawnIndex);
        if (pawn === wk || pawn === bk) continue;
        let moves = 0;
        kingTargets(bk, (to) => {
          if (to === wk || to === pawn || kingsTouch(to, wk)) return;
          const pawnAttacks =
            (FILE_OF(pawn) !== 0 && to === pawn + 7) ||
            (FILE_OF(pawn) !== 7 && to === pawn + 9);
          if (pawnAttacks) return;
          moves += 1;
        });
        const at = index(wk, bk, pawnIndex, 1);
        if (moves === 0) {
          const inCheck =
            kingsTouch(bk, wk) ||
            (FILE_OF(pawn) !== 0 && bk === pawn + 7) ||
            (FILE_OF(pawn) !== 7 && bk === pawn + 9);
          if (inCheck) table[at] = 0;
          else table[at] = NOT_WIN;
        } else remaining[at] = moves;
      }
    }
  }

  // BFS seeded by positions whose distance is already 0, then white moves into known children
  // including promotions into the finished KQK table.
  type Node = { wk: number; bk: number; pawnIndex: number; stm: number; dist: number };
  const queue: Node[] = [];
  for (let wk = 0; wk < 64; wk += 1) {
    for (let bk = 0; bk < 64; bk += 1) {
      if (wk === bk || kingsTouch(wk, bk)) continue;
      for (let pawnIndex = 0; pawnIndex < 48; pawnIndex += 1) {
        const pawn = pawnSq(pawnIndex);
        if (pawn === wk || pawn === bk) continue;
        const at = index(wk, bk, pawnIndex, 1);
        if (table[at] === 0) queue.push({ wk, bk, pawnIndex, stm: 1, dist: 0 });
      }
    }
  }

  const knownChild = (child: Child): number | null => {
    if (child.kind === 'kqk') {
      const value = kqk[child.at];
      if (value == null || value === UNKNOWN || value === NOT_WIN) return null;
      return value;
    }
    const value = table[index(child.wk, child.bk, child.pawnIndex, child.stm)];
    if (value == null || value === UNKNOWN || value === NOT_WIN) return null;
    return value;
  };

  // White-to-move positions that can move into an already known loss for black.
  const considerWhite = (wk: number, bk: number, pawnIndex: number) => {
    const pawn = pawnSq(pawnIndex);
    const at = index(wk, bk, pawnIndex, 0);
    if (table[at] !== UNKNOWN) return;
    let best = 999;
    for (const child of whiteChildren(wk, bk, pawn)) {
      const dist = knownChild(child);
      if (dist != null && dist + 1 < best) best = dist + 1;
    }
    if (best < 999) {
      table[at] = best;
      queue.push({ wk, bk, pawnIndex, stm: 0, dist: best });
    }
  };

  let cursor = 0;
  // Seed white moves into the initial mates and promotions.
  for (let wk = 0; wk < 64; wk += 1) {
    for (let bk = 0; bk < 64; bk += 1) {
      if (wk === bk || kingsTouch(wk, bk)) continue;
      for (let pawnIndex = 0; pawnIndex < 48; pawnIndex += 1) {
        const pawn = pawnSq(pawnIndex);
        if (pawn === wk || pawn === bk) continue;
        considerWhite(wk, bk, pawnIndex);
      }
    }
  }

  while (cursor < queue.length) {
    const current = queue[cursor]!;
    cursor += 1;
    if (current.stm === 0) {
      const pawn = pawnSq(current.pawnIndex);
      kingTargets(current.bk, (from) => {
        if (from === current.wk || from === pawn || kingsTouch(from, current.wk)) return;
        const pawnAttacks =
          (FILE_OF(pawn) !== 0 && from === pawn + 7) ||
          (FILE_OF(pawn) !== 7 && from === pawn + 9);
        if (pawnAttacks) return;
        const parent = index(current.wk, from, current.pawnIndex, 1);
        if (table[parent] !== UNKNOWN || remaining[parent] === 0) return;
        remaining[parent] -= 1;
        if (current.dist + 1 > worst[parent]!) worst[parent] = current.dist + 1;
        if (remaining[parent] === 0) {
          table[parent] = worst[parent]!;
          queue.push({
            wk: current.wk,
            bk: from,
            pawnIndex: current.pawnIndex,
            stm: 1,
            dist: worst[parent]!,
          });
        }
      });
    } else {
      // A newly proven black loss may unlock white parents. Rescan is expensive;
      // white parents are the king step or the pawn step that landed here.
      const pawn = pawnSq(current.pawnIndex);
      kingTargets(current.wk, (from) => {
        if (from === current.bk || from === pawn || kingsTouch(from, current.bk)) return;
        considerWhite(from, current.bk, current.pawnIndex);
      });
      if (RANK_OF(pawn) > 1) {
        const prev = pawn - 8;
        if (prev !== current.wk && prev !== current.bk) {
          considerWhite(current.wk, current.bk, pawnIndexOf(prev));
        }
      }
      if (RANK_OF(pawn) === 3) {
        const prev = pawn - 16;
        const mid = pawn - 8;
        if (prev !== current.wk && prev !== current.bk && mid !== current.wk && mid !== current.bk) {
          considerWhite(current.wk, current.bk, pawnIndexOf(prev));
        }
      }
    }
  }

  let maxDtm = 0;
  for (let i = 0; i < table.length; i += 1) {
    const value = table[i]!;
    if (value !== UNKNOWN && value !== NOT_WIN && value > maxDtm) maxDtm = value;
  }
  return { table, maxDtm };
}

function pawnIndexOf(sq: number): number {
  return (RANK_OF(sq) - 1) * 8 + FILE_OF(sq);
}

function parseBoard(fen: string): { squares: string[]; stm: 'w' | 'b' } | null {
  const [board, stm] = fen.split(' ');
  if (!board || (stm !== 'w' && stm !== 'b')) return null;
  const squares = Array<string>(64).fill('');
  const ranks = board.split('/');
  if (ranks.length !== 8) return null;
  for (let rank = 0; rank < 8; rank += 1) {
    let file = 0;
    for (const char of ranks[rank]!) {
      if (char >= '1' && char <= '8') {
        file += Number(char);
        continue;
      }
      if (file > 7) return null;
      squares[((7 - rank) << 3) | file] = char;
      file += 1;
    }
    if (file !== 8) return null;
  }
  return { squares, stm };
}

function flipSquare(sq: number): number {
  return sq ^ 56;
}

/**
 * Plies until `attacker` mates, or null when this material is not an enabled
 * exact family. `includeDisabled` is only for the coverage study.
 */
export function exactUserDtm(
  fen: string,
  attacker: 'w' | 'b',
  includeDisabled = false,
): number | null {
  const parsed = parseBoard(fen);
  if (!parsed) return null;
  let squares = parsed.squares;
  let stm = parsed.stm;
  if (attacker === 'b') {
    squares = squares.map((_, index) => squares[flipSquare(index)] ?? '');
    // Swap colors and ranks so the attacker is white.
    squares = squares.map((piece) => {
      if (!piece) return '';
      return piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase();
    });
    stm = stm === 'w' ? 'b' : 'w';
  }
  const white: number[] = [];
  const black: number[] = [];
  const list: Array<{ sq: number; piece: string }> = [];
  squares.forEach((piece, sq) => {
    if (!piece) return;
    list.push({ sq, piece });
    if (piece === piece.toUpperCase()) white.push(sq);
    else black.push(sq);
  });
  const counts = new Map<string, number>();
  for (const item of list) counts.set(item.piece, (counts.get(item.piece) ?? 0) + 1);
  const signature = [...counts.entries()].sort().map(([piece, n]) => `${piece}${n}`).join('');
  const stmBit = stm === 'w' ? 0 : 1;
  const wk = squares.findIndex((piece) => piece === 'K');
  const bk = squares.findIndex((piece) => piece === 'k');
  if (wk < 0 || bk < 0) return null;

  let family: Family | null = null;
  let pieceSq = -1;
  if (signature === 'K1Q1k1') {
    family = 'kqk';
    pieceSq = squares.findIndex((piece) => piece === 'Q');
  } else if (signature === 'K1R1k1') {
    family = 'krk';
    pieceSq = squares.findIndex((piece) => piece === 'R');
  } else if (signature === 'K1P1k1') {
    family = 'kpk';
    pieceSq = squares.findIndex((piece) => piece === 'P');
    if (RANK_OF(pieceSq) === 0 || RANK_OF(pieceSq) === 7) return null;
  } else {
    return null;
  }
  if (pieceSq < 0) return null;
  if (!includeDisabled && !ENABLED.has(family)) return null;
  const table = ensureFamily(family);
  const at =
    family === 'kpk'
      ? (((((wk << 6) | bk) << 6) | pawnIndexOf(pieceSq)) << 1) | stmBit
      : (((((wk << 6) | bk) << 6) | pieceSq) << 1) | stmBit;
  const value = table[at];
  if (value == null || value === UNKNOWN || value === NOT_WIN) return null;
  return value;
}

export function studyElementaryTables(): ElementaryStudy[] {
  const reports: ElementaryStudy[] = [];
  for (const family of ['kqk', 'krk', 'kpk'] as const) {
    const started = Date.now();
    tables.delete(family);
    if (family === 'kpk') kpkDependsOnKqk = false;
    const table = ensureFamily(family);
    let maxDtm = 0;
    let known = 0;
    for (let i = 0; i < table.length; i += 1) {
      const value = table[i]!;
      if (value !== UNKNOWN && value !== NOT_WIN) {
        known += 1;
        if (value > maxDtm) maxDtm = value;
      }
    }
    reports.push({
      family,
      enabled: ENABLED.has(family),
      positions: table.length,
      bytes: table.byteLength,
      buildMs: Date.now() - started,
      maxDtm,
      note:
        family === 'kpk'
          ? `${known} positions marquées gagnantes, mais le FEN catalogue KPK gagnant reste sans distance. Table non utilisée.`
          : `${known} positions marquées gagnantes. Contrôle : le coin dame n’est pas un mat en un coup, donc la table n’est pas utilisée.`,
    });
  }
  const corner = exactUserDtm('k7/8/8/8/8/8/8/K6Q w - - 0 1', 'w', true);
  const catalogQueen = exactUserDtm('8/8/8/4k3/8/8/8/4K2Q w - - 0 1', 'w', true);
  const mateInOne = exactUserDtm('7k/6Q1/6K1/8/8/8/8/8 w - - 0 1', 'w', true);
  const catalogKpk = exactUserDtm('8/8/8/4k3/8/3K4/4P3/8 w - - 0 1', 'w', true);
  const queen = reports.find((row) => row.family === 'kqk');
  if (queen) {
    queen.note += ` Sonde désactivée : coin dame = ${corner ?? 'null'} (ce n’est pas un mat en un coup), catalogue dame = ${catalogQueen ?? 'null'}, mat en un = ${mateInOne ?? 'null'}.`;
  }
  const pawn = reports.find((row) => row.family === 'kpk');
  if (pawn) {
    pawn.note += ` Sonde désactivée du FEN catalogue : ${catalogKpk ?? 'null'}.`;
  }
  reports.push({
    family: 'kbbk',
    enabled: false,
    positions: 64 * 64 * 32 * 32 * 2,
    bytes: 64 * 64 * 32 * 32 * 2,
    buildMs: 0,
    maxDtm: null,
    note: 'Non intégrée : 8 Mo de table et un calcul rétrograde trop long pour le fil de l’application. Ces finales passent par le moteur, note estimée.',
  });
  return reports;
}

export function resetElementaryTables(): void {
  tables.clear();
  kpkDependsOnKqk = false;
}
