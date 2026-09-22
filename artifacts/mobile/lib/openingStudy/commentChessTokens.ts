/**
 * Detect chess SAN tokens (English + French) inside comment prose.
 */
const PIECE = '[KQRBNRDFTC]';
const FILE = '[a-h]';
const RANK = '[1-8]';
const PROMO = '(?:=[QRBNRDFTC])?';
const CHECK = '[+#]?';
const CASTLE = '(?:O-O-O|O-O|0-0-0|0-0)';
const PIECE_MOVE = `${PIECE}x?${FILE}${RANK}${PROMO}${CHECK}`;
const PAWN_CAPTURE = `${FILE}x${FILE}${RANK}${PROMO}${CHECK}`;
const PAWN_MOVE = `${FILE}${RANK}${PROMO}${CHECK}`;
const SAN_BODY = `(?:${CASTLE}${CHECK}|${PIECE_MOVE}|${PAWN_CAPTURE}|${PAWN_MOVE})`;
const TOKEN_RE = new RegExp(`(?<![A-Za-z0-9])(?:\\.\\.\\.)?(${SAN_BODY})(?![A-Za-z0-9])`, 'g');

export type CommentToken =
  | { kind: 'text'; text: string }
  | { kind: 'san'; text: string; playable: boolean; playSans?: string[]; startFen?: string };

const FR_TO_EN: Record<string, string> = {
  R: 'K',
  D: 'Q',
  T: 'R',
  F: 'B',
  C: 'N',
};

export function englishSanGuess(token: string): string {
  const castle = token.replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O');
  return castle.replace(/^[RDFTC]/, (ch) => FR_TO_EN[ch] ?? ch);
}

export function tokenizeCommentSans(comment: string): CommentToken[] {
  const out: CommentToken[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(comment))) {
    const idx = m.index;
    if (idx > last) out.push({ kind: 'text', text: comment.slice(last, idx) });
    out.push({ kind: 'san', text: m[0]!, playable: false });
    last = idx + m[0]!.length;
  }
  if (last < comment.length) out.push({ kind: 'text', text: comment.slice(last) });
  return out.length ? out : [{ kind: 'text', text: comment }];
}

const SEQ_GAP = /^[\s,;:.\-–—'"]*(?:and|et|puis|then|ou|or)?[\s,;:.\-–—'"]*$/i;

/**
 * Consecutive SAN tokens (separated only by punctuation/whitespace/and/et) form a sequence.
 */
export function commentSanSequences(tokens: readonly CommentToken[]): string[][] {
  const sequences: string[][] = [];
  let current: string[] = [];
  for (const tok of tokens) {
    if (tok.kind === 'san') {
      current.push(tok.text.replace(/^\.\.\./, ''));
      continue;
    }
    if (current.length && SEQ_GAP.test(tok.text)) continue;
    if (current.length) {
      sequences.push(current);
      current = [];
    }
  }
  if (current.length) sequences.push(current);
  return sequences;
}
