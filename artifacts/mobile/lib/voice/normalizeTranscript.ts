/**
 * Transcript normalization layer.
 *
 * Converts raw STT output into a stable lowercase form suitable for chess
 * parsing. Does not decide what move was intended — that belongs to the
 * intent + legal-move resolver layers.
 *
 * Supports French and English spoken forms and common STT corruptions for
 * piece names and square coordinates.
 */
import { FILE_PHONETICS } from './vocabulary.ts';

const PIECE_WORDS =
  '(?:dame|cavalier|fou|tour|roi|pion|queen|knight|bishop|rook|king|pawn|prend|takes|captures)';

/**
 * Collapse phonetic file + spoken/digit rank into a square token like `f3`.
 * Used both standalone and after piece words.
 */
function joinFileAndRank(fileToken: string, rankToken: string): string | null {
  const file = FILE_PHONETICS[fileToken] ?? (/^[a-h]$/.test(fileToken) ? fileToken : null);
  const rankMap: Record<string, string> = {
    un: '1',
    une: '1',
    one: '1',
    deux: '2',
    two: '2',
    trois: '3',
    three: '3',
    quatre: '4',
    four: '4',
    cinq: '5',
    five: '5',
    six: '6',
    sept: '7',
    seven: '7',
    huit: '8',
    eight: '8',
  };
  const rank = rankMap[rankToken] ?? (/^[1-8]$/.test(rankToken) ? rankToken : null);
  if (!file || !rank) return null;
  return `${file}${rank}`;
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize a raw speech-recognition transcript for chess parsing.
 */
export function normalizeTranscript(raw: string): string {
  let n = stripDiacritics(raw)
    .toLowerCase()
    .replace(/[.,;:!?¿¡'"«»]/g, ' ')
    .replace(/[×✕✖]/g, ' x ')
    .replace(/\s+/g, ' ')
    .trim();

  // Digits that STT sometimes attaches with hyphen/underscore
  n = n.replace(/([a-h])[\-_]+([1-8])/g, '$1$2');

  // ── STT corruption / plural fixes (pieces) ──────────────────────────────
  n = n
    .replace(/\bdamage\b/g, 'dame')
    .replace(/\bdam\b/g, 'dame')
    .replace(/\bdoms?\b/g, 'dame')
    .replace(/\bdames\b/g, 'dame')
    .replace(/\bcavalerie\b/g, 'cavalier')
    .replace(/\bcavaliers\b/g, 'cavalier')
    .replace(/\bfous\b/g, 'fou')
    .replace(/\bfoul\b/g, 'fou')
    .replace(/\btours\b/g, 'tour')
    .replace(/\bpions\b/g, 'pion')
    .replace(/\bknights\b/g, 'knight')
    .replace(/\bbishops\b/g, 'bishop')
    .replace(/\brooks\b/g, 'rook')
    .replace(/\bqueens\b/g, 'queen')
    .replace(/\bpawns\b/g, 'pawn');

  // ── Castling (before piece-name mapping so "rock" ≠ rook) ───────────────
  // Queenside (O-O-O) MUST be matched before kingside (O-O).
  n = n
    .replace(
      /\b(grand\s+ro[ck]e?|roque\s+cote\s+dame|queenside\s+castl(?:ing|e)|castle\s+queenside|long\s+castl(?:ing|e)|o\s*-\s*o\s*-\s*o|0\s*-\s*0\s*-\s*0)\b/g,
      'grand roque',
    )
    .replace(
      /\b(petit\s+ro[ck]e?|roque\s+cote\s+roi|kingside\s+castl(?:ing|e)|castle\s+kingside|short\s+castl(?:ing|e)|o\s*-\s*o|0\s*-\s*0)\b/g,
      'petit roque',
    )
    .replace(/\b(roc|rok|rock)\b/g, 'roque');

  // ── Capture verbs ───────────────────────────────────────────────────────
  n = n
    .replace(/\btakes\s+on\b/g, 'prend')
    .replace(/\btakes\b/g, 'prend')
    .replace(/\bcaptures\b/g, 'prend')
    .replace(/\bprends?\b/g, 'prend')
    .replace(/\bprises?\b/g, 'prend')
    .replace(/\bfois\b/g, 'prend')
    .replace(/\bx\b/g, 'prend');

  // ── English piece names kept (bilingual resolver uses both) ─────────────
  // STT often mangles piece names — recover before square joining.
  n = n
    .replace(/\bnight\b/g, 'knight')
    .replace(/\bnite\b/g, 'knight')
    .replace(/\bknite\b/g, 'knight')
    .replace(/\bnil\b/g, 'knight')
    .replace(/\bbishoppe?\b/g, 'bishop')
    .replace(/\bwhich\s+shop\b/g, 'bishop')
    .replace(/\bcav\b/g, 'cavalier')
    .replace(/\bcavale?\b/g, 'cavalier');

  // ── Check / mate suffixes (strip later in intent; normalize spelling) ───
  n = n
    .replace(/\bechec\s+et\s+mat\b/g, 'mat')
    .replace(/\bcheck\s*mate\b/g, 'mat')
    .replace(/\bcheckmate\b/g, 'mat')
    .replace(/\bechec\b/g, 'echec')
    .replace(/\bcheck\b/g, 'echec');

  // ── Spoken ranks → digits (global; safe for chess speech) ───────────────
  n = n
    .replace(/\bquatre\b/g, '4')
    .replace(/\bfour\b/g, '4')
    .replace(/\bcinq\b/g, '5')
    .replace(/\bfive\b/g, '5')
    .replace(/\bsix\b/g, '6')
    .replace(/\bsept\b/g, '7')
    .replace(/\bseven\b/g, '7')
    .replace(/\bhuit\b/g, '8')
    .replace(/\beight\b/g, '8')
    .replace(/\bdeux\b/g, '2')
    .replace(/\btwo\b/g, '2')
    .replace(/\btrois\b/g, '3')
    .replace(/\bthree\b/g, '3')
    .replace(/\b(une|un|one)\b/g, '1');

  // ── Promotion phrases / algebraic suffixes ──────────────────────────────
  // Run before spoken-letter→piece recovery so "promotion en dame" keeps "en".
  n = n
    .replace(/\bpromoti(?:on|onne?)\s+(en\s+)?dame\b/g, 'promo dame')
    .replace(/\bpromoti(?:on|onne?)\s+(en\s+)?queen\b/g, 'promo queen')
    .replace(/=([dqtrbncf])/gi, (_, p: string) => {
      const map: Record<string, string> = {
        d: ' promo dame',
        q: ' promo queen',
        t: ' promo tour',
        r: ' promo rook',
        f: ' promo fou',
        b: ' promo bishop',
        c: ' promo cavalier',
        n: ' promo knight',
      };
      return map[p.toLowerCase()] ?? ` promo ${p}`;
    });

  // ── Square recovery: piece-word + phonetic file + rank ──────────────────
  n = n.replace(
    new RegExp(`\\b(${PIECE_WORDS})\\s+([a-z']+)\\s+([1-8])\\b`, 'g'),
    (full, piece: string, fileTok: string, rank: string) => {
      const sq = joinFileAndRank(fileTok, rank);
      return sq ? `${piece} ${sq}` : full;
    },
  );

  // Standalone phonetic square at start / end (pawn moves, bare squares)
  n = n.replace(
    /(?:^|\s)([a-z']+)\s+([1-8])(?=\s|$)/g,
    (full, fileTok: string, rank: string) => {
      const sq = joinFileAndRank(fileTok, rank);
      return sq ? ` ${sq}` : full;
    },
  );

  // Compact letter + digit with space: "f 3" → "f3", "C f 3" handled via above
  n = n.replace(/\b([a-h])\s+([1-8])\b/g, '$1$2');

  // Spoken SAN letter names before a square → preserve piece letter.
  // MUST run after "c 3" → "c3" so STT "en c 3" / "enne c3" becomes "nc3"
  // (not bare "c3" → false pawn). Same for bee/ar/cue/kay letter names.
  n = n
    .replace(/\b(enne|en|an)\s+([a-h][1-8])\b/g, 'n$2')
    .replace(/\b(bee|bé|be)\s+([a-h][1-8])\b/g, 'b$2')
    .replace(/\b(ar|are)\s+([a-h][1-8])\b/g, 'r$2')
    .replace(/\b(cue|kyu|queue)\s+([a-h][1-8])\b/g, 'q$2')
    .replace(/\b(kay|kei)\s+([a-h][1-8])\b/g, 'k$2');

  // Compact French/English SAN-like tokens with spaces: "N f3" / "C f3".
  // MUST run after bare file+rank collapse so "N f 3" → "N f3" → "nf3".
  // Never drop the piece letter — that caused pawn false-positives.
  n = n.replace(/\b([nbrqkcdft])\s+([a-h][1-8])\b/gi, (_, p: string, sq: string) => {
    return `${p.toLowerCase()}${sq}`;
  });

  // "cavalier c3" / "knight b4" stay as spoken forms for extractMoveIntent.
  // Also accept glued spoken+square without space after STT glitches:
  // "cavalierc3" → "cavalier c3"
  n = n.replace(
    /\b(dame|cavalier|fou|tour|roi|pion|queen|knight|bishop|rook|king|pawn)([a-h][1-8])\b/g,
    '$1 $2',
  );

  return n.replace(/\s+/g, ' ').trim();
}

/**
 * Backward-compatible alias used historically as `normalize` in chessParser.
 */
export const normalize = normalizeTranscript;
