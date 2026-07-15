/**
 * Extract a structured chess move intent from a normalized transcript.
 * Does not consult the board — legality is resolved in resolveLegalMove.
 */
import type { MoveIntent } from './types.ts';
import { SPOKEN_PIECE_TO_LETTER, type PieceLetter } from './vocabulary.ts';

const SQUARE = '([a-h][1-8])';
const FILE = '([a-h])';

function promoFromToken(tok: string | undefined): MoveIntent['promotion'] {
  if (!tok) return undefined;
  const map: Record<string, MoveIntent['promotion']> = {
    dame: 'q',
    queen: 'q',
    d: 'q',
    q: 'q',
    tour: 'r',
    rook: 'r',
    t: 'r',
    r: 'r',
    fou: 'b',
    bishop: 'b',
    f: 'b',
    b: 'b',
    cavalier: 'n',
    knight: 'n',
    c: 'n',
    n: 'n',
  };
  return map[tok];
}

function stripCheckHints(s: string): { text: string; checkHint: boolean } {
  let checkHint = false;
  let text = s;
  if (/\b(echec|mat)\b/.test(text) || /\+$/.test(text)) {
    checkHint = true;
  }
  text = text
    .replace(/\b(echec|mat)\b/g, ' ')
    .replace(/[+#‼!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { text, checkHint };
}

function pieceFromSpoken(word: string): PieceLetter | undefined {
  return SPOKEN_PIECE_TO_LETTER[word];
}

function pieceFromSanLetter(letter: string): PieceLetter | undefined {
  const u = letter.toUpperCase();
  // Prefer English SAN for letters that collide with French (notably R).
  // French Roi is handled via spoken "roi" and frenchSanToEnglish in the
  // direct-SAN path; French rook is uniquely "T".
  switch (u) {
    case 'N':
    case 'C':
      return 'n';
    case 'B':
    case 'F':
      return 'b';
    case 'R':
    case 'T':
      return 'r';
    case 'Q':
    case 'D':
      return 'q';
    case 'K':
      return 'k';
    default:
      return undefined;
  }
}

/**
 * Try to extract move intent from normalized speech / algebraic text.
 */
export function extractMoveIntent(normalized: string): MoveIntent | null {
  const { text: base, checkHint } = stripCheckHints(normalized);
  if (!base) return null;

  // Castling
  if (/\bpetit\s+roque\b/.test(base) || /\broque\s+cote\s+roi\b/.test(base)) {
    return { castle: 'kingside', checkHint };
  }
  if (/\bgrand\s+roque\b/.test(base) || /\broque\s+cote\s+dame\b/.test(base)) {
    return { castle: 'queenside', checkHint };
  }
  const nospace = base.replace(/\s+/g, '');
  if (/^(o-o-o|0-0-0)$/i.test(nospace)) {
    return { castle: 'queenside', checkHint };
  }
  if (/^(o-o|0-0)$/i.test(nospace)) {
    return { castle: 'kingside', checkHint };
  }
  if (/^roque$/.test(base)) {
    return { castle: 'kingside', checkHint };
  }

  let text = base;
  let promotion: MoveIntent['promotion'] | undefined;

  const promoTail = text.match(
    /^(.+?)\s+(?:promo\s+)?(dame|queen|tour|rook|fou|bishop|cavalier|knight|[dqtrbncf])$/,
  );
  if (promoTail) {
    const p = promoFromToken(promoTail[2]);
    if (p) {
      promotion = p;
      text = promoTail[1].trim();
    }
  }

  const compactPromo = text.match(/^(.+?)=([dqtrbncfrnbrqk])$/i);
  if (compactPromo) {
    const p = promoFromToken(compactPromo[2].toLowerCase());
    if (p) {
      promotion = p;
      text = compactPromo[1].trim();
    }
  }

  // From-square + to: "cavalier g1 f3" / "knight from g1 to f3"
  {
    const m = text.match(
      new RegExp(
        `\\b(dame|cavalier|fou|tour|roi|pion|queen|knight|bishop|rook|king|pawn)\\b` +
          `(?:\\s+(?:de|from|en))?\\s*${SQUARE}` +
          `(?:\\s+(?:vers|to|a))?\\s*${SQUARE}$`,
      ),
    );
    if (m) {
      return {
        piece: pieceFromSpoken(m[1]),
        fromSquare: m[2],
        to: m[3],
        promotion,
        checkHint,
      };
    }
  }

  // Capture: "cavalier prend d5", "e prend d5", "pion e prend d5"
  {
    const m = text.match(
      new RegExp(
        `^(?:(dame|cavalier|fou|tour|roi|pion|queen|knight|bishop|rook|king|pawn)\\s+)?` +
          `(?:${FILE}\\s+)?` +
          `prend\\s+` +
          `${SQUARE}$`,
      ),
    );
    if (m) {
      const spokenPiece = m[1] ? pieceFromSpoken(m[1]) : undefined;
      return {
        piece: spokenPiece ?? (m[2] ? 'p' : undefined),
        fromFile: m[2],
        to: m[3],
        capture: true,
        promotion,
        checkHint,
      };
    }
  }

  // Disambiguation file: "cavalier g f3", "knight g to f3", "tour a e1"
  {
    const m = text.match(
      new RegExp(
        `^(dame|cavalier|fou|tour|roi|pion|queen|knight|bishop|rook|king|pawn)` +
          `\\s+${FILE}` +
          `(?:\\s+(?:to|vers|a))?` +
          `\\s+${SQUARE}$`,
      ),
    );
    if (m) {
      return {
        piece: pieceFromSpoken(m[1]),
        fromFile: m[2],
        to: m[3],
        promotion,
        checkHint,
      };
    }
  }

  // Piece + destination: "cavalier f3", "bishop b5"
  {
    const m = text.match(
      new RegExp(
        `^(dame|cavalier|fou|tour|roi|pion|queen|knight|bishop|rook|king|pawn)` +
          `(?:\\s+(?:en|to|vers))?` +
          `\\s+${SQUARE}$`,
      ),
    );
    if (m) {
      return {
        piece: pieceFromSpoken(m[1]),
        to: m[2],
        promotion,
        checkHint,
      };
    }
  }

  // Bare / named pawn destination: "e4", "pion e4"
  {
    const m = text.match(new RegExp(`^(?:(pion|pawn)\\s+)?${SQUARE}$`));
    if (m) {
      return {
        piece: 'p',
        to: m[2],
        promotion,
        checkHint,
      };
    }
  }

  return extractSanLikeIntent(text.replace(/\s+/g, ''), promotion, checkHint);
}

/**
 * Parse algebraic-like compact tokens: Nf3, Cf3, Ngf3, exd5, e4, e8=Q…
 */
export function extractSanLikeIntent(
  compact: string,
  promotion?: MoveIntent['promotion'],
  checkHint?: boolean,
): MoveIntent | null {
  let s = compact.replace(/[+#]+$/g, '');
  if (!s) return null;

  if (/^(o-o-o|0-0-0)$/i.test(s)) return { castle: 'queenside', promotion, checkHint };
  if (/^(o-o|0-0)$/i.test(s)) return { castle: 'kingside', promotion, checkHint };

  let promo = promotion;
  const promoM = s.match(/=([nbrqdftck])$/i);
  if (promoM) {
    const letter = promoM[1].toLowerCase();
    promo =
      letter === 'q' || letter === 'd'
        ? 'q'
        : letter === 'r' || letter === 't'
          ? 'r'
          : letter === 'b' || letter === 'f'
            ? 'b'
            : letter === 'n' || letter === 'c'
              ? 'n'
              : promo;
    s = s.slice(0, -2);
  }

  // Pawn capture: exd5
  {
    const m = s.match(/^([a-h])x([a-h][1-8])$/i);
    if (m) {
      return {
        piece: 'p',
        fromFile: m[1].toLowerCase(),
        to: m[2].toLowerCase(),
        capture: true,
        promotion: promo,
        checkHint,
      };
    }
  }

  // From-square disambiguation first: Ng1f3
  {
    const m = s.match(/^([nbrqckdft])([a-h][1-8])([a-h][1-8])$/i);
    if (m) {
      const piece = pieceFromSanLetter(m[1]);
      if (piece && piece !== 'p') {
        return {
          piece,
          fromSquare: m[2].toLowerCase(),
          to: m[3].toLowerCase(),
          promotion: promo,
          checkHint,
        };
      }
    }
  }

  // Piece move: Nf3, Ngf3, Nxe5, Rae1, Cf3…
  {
    const m = s.match(/^([nbrqckdft])([a-h])?([1-8])?(x)?([a-h][1-8])$/i);
    if (m) {
      const piece = pieceFromSanLetter(m[1]);
      if (piece && piece !== 'p') {
        return {
          piece,
          fromFile: m[2]?.toLowerCase(),
          fromRank: m[3],
          to: m[5].toLowerCase(),
          capture: !!m[4],
          promotion: promo,
          checkHint,
        };
      }
    }
  }

  // Quiet pawn: e4
  {
    const m = s.match(/^([a-h][1-8])$/i);
    if (m) {
      return {
        piece: 'p',
        to: m[1].toLowerCase(),
        promotion: promo,
        checkHint,
      };
    }
  }

  return null;
}

/** Describe intent for diagnostics / illegal feedback. */
export function describeIntent(intent: MoveIntent): string {
  if (intent.castle === 'kingside') return 'O-O';
  if (intent.castle === 'queenside') return 'O-O-O';
  const pieceMap: Record<string, string> = {
    p: '',
    n: 'N',
    b: 'B',
    r: 'R',
    q: 'Q',
    k: 'K',
  };
  let out = pieceMap[intent.piece ?? 'p'] ?? '';
  if (intent.fromSquare) out += intent.fromSquare;
  else {
    if (intent.fromFile) out += intent.fromFile;
    if (intent.fromRank) out += intent.fromRank;
  }
  if (intent.capture) out += 'x';
  if (intent.to) out += intent.to;
  if (intent.promotion) out += `=${intent.promotion.toUpperCase()}`;
  return out || '(unknown)';
}
