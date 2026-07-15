/**
 * Generate unambiguous questions from a history analysis.
 */
import type { HistoryAnalysis, TrackedPiece } from './PositionHistoryAnalyzer.ts';
import { countDeveloped, pieceOnSquare } from './PositionHistoryAnalyzer.ts';

export type QuestionKind =
  | 'locate_piece'
  | 'piece_on_square'
  | 'still_on_board'
  | 'what_captured'
  | 'count_developed';

export type PositionQuestion = {
  id: string;
  kind: QuestionKind;
  promptFr: string;
  /** Canonical answers (normalized lowercase). */
  accepted: string[];
  /** Human-readable correct answer for feedback. */
  displayAnswer: string;
};

const PIECE_FR: Record<string, string> = {
  p: 'pion',
  n: 'cavalier',
  b: 'fou',
  r: 'tour',
  q: 'dame',
  k: 'roi',
};

const COLOR_FR: Record<string, string> = {
  w: 'blanc',
  b: 'noir',
};

function colorAdj(color: 'w' | 'b', type: string): string {
  if (color === 'w') {
    return type === 'dame' || type === 'tour' ? 'blanche' : 'blanc';
  }
  return type === 'dame' || type === 'tour' ? 'noire' : 'noir';
}

function piecePhrase(p: TrackedPiece): string {
  const name = PIECE_FR[p.type];
  return `${name} ${colorAdj(p.color, name)}`;
}

/**
 * Build a short list of unambiguous questions for this position.
 */
export function generateQuestions(
  analysis: HistoryAnalysis,
  options: { maxQuestions?: number; rng?: () => number } = {},
): PositionQuestion[] {
  const max = options.maxQuestions ?? 5;
  const rng = options.rng ?? Math.random;
  const pool: PositionQuestion[] = [];
  const { pieces } = analysis;

  // Locate: pieces that left start and are unique by (color,type,start)
  for (const p of pieces) {
    if (p.captured || !p.currentSquare) continue;
    if (p.currentSquare === p.startSquare) continue;
    if (p.type === 'p' && p.currentSquare[1] === p.startSquare[1]) continue;
    const name = PIECE_FR[p.type];
    pool.push({
      id: `locate:${p.id}`,
      kind: 'locate_piece',
      promptFr: `Où se trouve le ${name} ${colorAdj(p.color, name)} parti de ${p.startSquare} ?`,
      accepted: [
        p.currentSquare,
        `${name} ${p.currentSquare}`,
        `il est en ${p.currentSquare}`,
        `${p.currentSquare}`,
      ].map(normalizeAnswer),
      displayAnswer: p.currentSquare,
    });
  }

  // Piece on square — occupied squares with unique content
  for (const p of pieces) {
    if (p.captured || !p.currentSquare) continue;
    const name = PIECE_FR[p.type];
    const phrase = piecePhrase(p);
    pool.push({
      id: `onsq:${p.currentSquare}`,
      kind: 'piece_on_square',
      promptFr: `Quelle pièce se trouve en ${p.currentSquare} ?`,
      accepted: [
        phrase,
        name,
        `${name} ${COLOR_FR[p.color]}`,
        p.color === 'w' ? `white ${name}` : `black ${name}`,
        englishPiece(p.type),
      ].map(normalizeAnswer),
      displayAnswer: phrase,
    });
  }

  // Still on board — prefer pawns that may have been captured
  for (const p of pieces.filter((x) => x.type === 'p')) {
    const name = PIECE_FR[p.type];
    const yes = !p.captured;
    pool.push({
      id: `alive:${p.id}`,
      kind: 'still_on_board',
      promptFr: `Le ${name} ${colorAdj(p.color, name)} parti de ${p.startSquare} est-il encore sur l'échiquier ?`,
      accepted: (yes
        ? ['oui', 'yes', 'encore', 'il est encore', 'toujours']
        : ['non', 'no', 'capture', 'capturé', 'il a été capturé', 'pris']
      ).map(normalizeAnswer),
      displayAnswer: yes ? 'Oui' : 'Non — il a été capturé',
    });
  }

  // What was captured — if exactly one capture, ask for it
  const captured = pieces.filter((p) => p.captured);
  if (captured.length === 1) {
    const p = captured[0];
    const phrase = piecePhrase(p);
    pool.push({
      id: `cap:${p.id}`,
      kind: 'what_captured',
      promptFr: 'Quelle pièce a été capturée ?',
      accepted: [phrase, PIECE_FR[p.type], englishPiece(p.type)].map(normalizeAnswer),
      displayAnswer: phrase,
    });
  }

  // Developed white pieces count
  const developed = countDeveloped(pieces, 'w');
  pool.push({
    id: `dev:w:${developed}`,
    kind: 'count_developed',
    promptFr: 'Combien de pièces blanches ont quitté leur case initiale ?',
    accepted: [String(developed), `${developed}`].map(normalizeAnswer),
    displayAnswer: String(developed),
  });

  // Shuffle lightly and dedupe by kind preference
  const shuffled = [...pool].sort(() => rng() - 0.5);
  const picked: PositionQuestion[] = [];
  const seenKinds = new Set<string>();
  for (const q of shuffled) {
    // Prefer variety of kinds
    const key = q.kind;
    if (picked.length >= max) break;
    if (seenKinds.has(key) && picked.length >= 3) continue;
    // Avoid duplicate onsq for same square
    if (picked.some((p) => p.id === q.id)) continue;
    picked.push(q);
    seenKinds.add(key);
  }
  return picked.slice(0, max);
}

function englishPiece(type: string): string {
  const map: Record<string, string> = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
  };
  return map[type] ?? type;
}

export function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
