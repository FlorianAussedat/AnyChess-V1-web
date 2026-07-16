/**
 * Generate unambiguous questions from a history analysis.
 */
import { identifyOpeningFromSans } from '../openings/OpeningIdentifier.ts';
import { openingAliasRepository } from '../openingQuiz/OpeningAliasRepository.ts';
import { normalizeOpeningName } from '../openingQuiz/OpeningNameNormalizer.ts';
import type { HistoryAnalysis, PieceColor, TrackedPiece } from './PositionHistoryAnalyzer.ts';
import {
  countDeveloped,
  pieceAtFen,
  pieceById,
  squareAtHalfMove,
} from './PositionHistoryAnalyzer.ts';

export type QuestionCategory =
  | 'opening'
  | 'move_history'
  | 'captures'
  | 'castling'
  | 'location'
  | 'piece_status'
  | 'position_state'
  | 'development'
  | 'temporal';

export type QuestionKind =
  | 'opening_id'
  | 'nth_white_move'
  | 'nth_black_move'
  | 'last_white_move'
  | 'last_black_move'
  | 'last_sequence_move'
  | 'last_piece_moved'
  | 'capture_count'
  | 'capture_count_by_color'
  | 'first_capture'
  | 'last_capture'
  | 'capture_order_nth'
  | 'who_captured_piece'
  | 'castling_rights'
  | 'castling_played'
  | 'castling_side'
  | 'locate_piece'
  | 'piece_on_square'
  | 'color_on_square'
  | 'still_on_board'
  | 'remaining_piece_type_count'
  | 'side_to_move'
  | 'king_in_check'
  | 'piece_count_color'
  | 'count_developed'
  | 'piece_move_count'
  | 'first_white_piece_moved'
  | 'temporal_piece_location'
  | 'temporal_square_occupancy';

export type PositionQuestion = {
  id: string;
  kind: QuestionKind;
  category: QuestionCategory;
  /** Dedup key for the underlying fact. */
  factKey: string;
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

const CASTLE_SIDE_FR = {
  kingside: 'petit côté',
  queenside: 'grand côté',
} as const;

function colorAdj(color: PieceColor, type: string): string {
  if (color === 'w') {
    return type === 'dame' || type === 'tour' ? 'blanche' : 'blanc';
  }
  return type === 'dame' || type === 'tour' ? 'noire' : 'noir';
}

function piecePhrase(p: TrackedPiece): string {
  const name = PIECE_FR[p.type];
  return `${name} ${colorAdj(p.color, name)}`;
}

function piecePhraseFrom(type: string, color: PieceColor): string {
  const name = PIECE_FR[type];
  return `${name} ${colorAdj(color, name)}`;
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

function yesNoAnswers(yes: boolean): string[] {
  return (yes
    ? ['oui', 'yes', 'vrai', 'true']
    : ['non', 'no', 'faux', 'false']
  ).map(normalizeAnswer);
}

function colorAnswers(color: PieceColor): string[] {
  const fr = color === 'w' ? ['blanc', 'blancs', 'white'] : ['noir', 'noirs', 'black'];
  return fr.map(normalizeAnswer);
}

function sanAnswers(san: string): string[] {
  return [san, san.replace(/\+/g, ''), san.replace(/#/g, '')].map(normalizeAnswer);
}

function openingAccepted(canonicalName: string): string[] {
  const family = canonicalName.split(':')[0].trim();
  const names = new Set<string>();
  for (const n of openingAliasRepository.aliasesFor(canonicalName)) {
    names.add(normalizeOpeningName(n));
  }
  if (canonicalName.includes(':')) {
    for (const n of openingAliasRepository.aliasesFor(family)) {
      names.add(normalizeOpeningName(n));
    }
  }
  return [...names];
}

function isReliableOpening(analysis: HistoryAnalysis): { name: string; eco: string } | null {
  const hit = identifyOpeningFromSans(analysis.sans);
  if (!hit) return null;
  if (hit.ply !== analysis.sans.length) return null;
  return { name: hit.name, eco: hit.eco };
}

function moverAt(analysis: HistoryAnalysis, halfMoveIndex: number): TrackedPiece | null {
  const id = analysis.moverPieceIdByHalfMove[halfMoveIndex];
  if (!id) return null;
  return pieceById(analysis.pieces, id);
}

/** Build the full eligible question pool (before dedup/selection). */
export function buildQuestionPool(analysis: HistoryAnalysis): PositionQuestion[] {
  const pool: PositionQuestion[] = [];
  const { pieces, captureHistory } = analysis;

  const opening = isReliableOpening(analysis);
  if (opening) {
    pool.push({
      id: `opening:${opening.eco}`,
      kind: 'opening_id',
      category: 'opening',
      factKey: `opening:${opening.name}`,
      promptFr: 'Quelle ouverture a été jouée ?',
      accepted: openingAccepted(opening.name),
      displayAnswer: opening.name,
    });
  }

  if (analysis.whiteSans.length >= 1) {
    const n = 1;
    const san = analysis.whiteSans[n - 1];
    pool.push({
      id: `nthw:${n}`,
      kind: 'nth_white_move',
      category: 'move_history',
      factKey: `nth_white:${n}`,
      promptFr: `Quel est le ${n}${n === 1 ? 'er' : 'e'} coup des Blancs ?`,
      accepted: sanAnswers(san),
      displayAnswer: san,
    });
  }
  if (analysis.whiteSans.length >= 2) {
    const n = 2;
    const san = analysis.whiteSans[n - 1];
    pool.push({
      id: `nthw:${n}`,
      kind: 'nth_white_move',
      category: 'move_history',
      factKey: `nth_white:${n}`,
      promptFr: `Quel est le ${n}e coup des Blancs ?`,
      accepted: sanAnswers(san),
      displayAnswer: san,
    });
  }
  if (analysis.blackSans.length >= 1) {
    const n = 1;
    const san = analysis.blackSans[n - 1];
    pool.push({
      id: `nthb:${n}`,
      kind: 'nth_black_move',
      category: 'move_history',
      factKey: `nth_black:${n}`,
      promptFr: `Quel est le ${n}${n === 1 ? 'er' : 'e'} coup des Noirs ?`,
      accepted: sanAnswers(san),
      displayAnswer: san,
    });
  }
  if (analysis.blackSans.length >= 2) {
    const n = 2;
    const san = analysis.blackSans[n - 1];
    pool.push({
      id: `nthb:${n}`,
      kind: 'nth_black_move',
      category: 'move_history',
      factKey: `nth_black:${n}`,
      promptFr: `Quel est le ${n}e coup des Noirs ?`,
      accepted: sanAnswers(san),
      displayAnswer: san,
    });
  }

  if (analysis.whiteSans.length) {
    const san = analysis.whiteSans[analysis.whiteSans.length - 1];
    pool.push({
      id: 'lastw',
      kind: 'last_white_move',
      category: 'move_history',
      factKey: 'last_white_move',
      promptFr: 'Quel est le dernier coup des Blancs ?',
      accepted: sanAnswers(san),
      displayAnswer: san,
    });
  }
  if (analysis.blackSans.length) {
    const san = analysis.blackSans[analysis.blackSans.length - 1];
    pool.push({
      id: 'lastb',
      kind: 'last_black_move',
      category: 'move_history',
      factKey: 'last_black_move',
      promptFr: 'Quel est le dernier coup des Noirs ?',
      accepted: sanAnswers(san),
      displayAnswer: san,
    });
  }
  if (analysis.sans.length) {
    const san = analysis.sans[analysis.sans.length - 1];
    pool.push({
      id: 'lastseq',
      kind: 'last_sequence_move',
      category: 'move_history',
      factKey: 'last_sequence_move',
      promptFr: 'Quel est le dernier coup de la séquence ?',
      accepted: sanAnswers(san),
      displayAnswer: san,
    });
    const lastIdx = analysis.sans.length - 1;
    const lastMover = moverAt(analysis, lastIdx);
    if (lastMover) {
      pool.push({
        id: 'lastmover',
        kind: 'last_piece_moved',
        category: 'move_history',
        factKey: 'last_piece_moved',
        promptFr: 'Quelle pièce a joué le dernier coup ?',
        accepted: [
          piecePhrase(lastMover),
          PIECE_FR[lastMover.type],
          englishPiece(lastMover.type),
        ].map(normalizeAnswer),
        displayAnswer: piecePhrase(lastMover),
      });
    }
  }

  if (captureHistory.length > 0) {
    pool.push({
      id: 'capcount',
      kind: 'capture_count',
      category: 'captures',
      factKey: 'capture_count',
      promptFr: 'Combien de captures ont été jouées ?',
      accepted: [String(captureHistory.length)].map(normalizeAnswer),
      displayAnswer: String(captureHistory.length),
    });

    const whiteVictims = captureHistory.filter((c) => c.color === 'w').length;
    const blackVictims = captureHistory.filter((c) => c.color === 'b').length;
    if (whiteVictims > 0) {
      pool.push({
        id: 'capcount:w',
        kind: 'capture_count_by_color',
        category: 'captures',
        factKey: 'capture_count_white_victims',
        promptFr: 'Combien de pièces blanches ont été capturées ?',
        accepted: [String(whiteVictims)].map(normalizeAnswer),
        displayAnswer: String(whiteVictims),
      });
    }
    if (blackVictims > 0) {
      pool.push({
        id: 'capcount:b',
        kind: 'capture_count_by_color',
        category: 'captures',
        factKey: 'capture_count_black_victims',
        promptFr: 'Combien de pièces noires ont été capturées ?',
        accepted: [String(blackVictims)].map(normalizeAnswer),
        displayAnswer: String(blackVictims),
      });
    }

    const first = captureHistory[0];
    pool.push({
      id: 'capfirst',
      kind: 'first_capture',
      category: 'captures',
      factKey: 'first_capture',
      promptFr: 'Quelle pièce a été capturée en premier ?',
      accepted: [
        piecePhraseFrom(first.pieceType, first.color),
        PIECE_FR[first.pieceType],
      ].map(normalizeAnswer),
      displayAnswer: piecePhraseFrom(first.pieceType, first.color),
    });

    const last = captureHistory[captureHistory.length - 1];
    pool.push({
      id: 'caplast',
      kind: 'last_capture',
      category: 'captures',
      factKey: 'last_capture',
      promptFr: 'Quelle pièce a été capturée en dernier ?',
      accepted: [
        piecePhraseFrom(last.pieceType, last.color),
        PIECE_FR[last.pieceType],
      ].map(normalizeAnswer),
      displayAnswer: piecePhraseFrom(last.pieceType, last.color),
    });

    if (captureHistory.length >= 2) {
      const nth = 2;
      const cap = captureHistory[nth - 1];
      pool.push({
        id: `capnth:${nth}`,
        kind: 'capture_order_nth',
        category: 'captures',
        factKey: `capture_nth:${nth}`,
        promptFr: `Quelle pièce a été capturée en ${nth}e position ?`,
        accepted: [
          piecePhraseFrom(cap.pieceType, cap.color),
          PIECE_FR[cap.pieceType],
        ].map(normalizeAnswer),
        displayAnswer: piecePhraseFrom(cap.pieceType, cap.color),
      });
    }

    for (const cap of captureHistory) {
      const victimPieces = pieces.filter(
        (p) => p.captured && p.type === cap.pieceType && p.color === cap.color,
      );
      if (victimPieces.length === 1) {
        const v = victimPieces[0];
        pool.push({
          id: `whocap:${v.id}`,
          kind: 'who_captured_piece',
          category: 'captures',
          factKey: `who_captured:${v.id}`,
          promptFr: `Quelle pièce a capturé le ${PIECE_FR[v.type]} ${colorAdj(v.color, PIECE_FR[v.type])} parti de ${v.startSquare} ?`,
          accepted: [
            piecePhraseFrom(cap.capturedByType, cap.capturedByColor),
            PIECE_FR[cap.capturedByType],
          ].map(normalizeAnswer),
          displayAnswer: piecePhraseFrom(cap.capturedByType, cap.capturedByColor),
        });
      }
    }
  }

  const rights = analysis.castlingRightsRemaining;
  pool.push({
    id: 'castlewk',
    kind: 'castling_rights',
    category: 'castling',
    factKey: 'castling_rights:white_kingside',
    promptFr: 'Les Blancs peuvent-ils encore roquer petit côté ?',
    accepted: yesNoAnswers(rights.whiteKing),
    displayAnswer: rights.whiteKing ? 'Oui' : 'Non',
  });
  pool.push({
    id: 'castlebq',
    kind: 'castling_rights',
    category: 'castling',
    factKey: 'castling_rights:black_queenside',
    promptFr: 'Les Noirs peuvent-ils encore roquer grand côté ?',
    accepted: yesNoAnswers(rights.blackQueen),
    displayAnswer: rights.blackQueen ? 'Oui' : 'Non',
  });

  if (analysis.castlingPlayed.length) {
    const played = analysis.castlingPlayed[0];
    pool.push({
      id: 'castleplayed',
      kind: 'castling_played',
      category: 'castling',
      factKey: 'castling_played:any',
      promptFr: 'Y a-t-il eu un roque dans la séquence ?',
      accepted: yesNoAnswers(true),
      displayAnswer: 'Oui',
    });
    pool.push({
      id: `castleside:${played.color}:${played.side}`,
      kind: 'castling_side',
      category: 'castling',
      factKey: `castling_side:${played.color}:${played.side}`,
      promptFr: `Les ${played.color === 'w' ? 'Blancs' : 'Noirs'} ont-ils roqué ${CASTLE_SIDE_FR[played.side]} ?`,
      accepted: yesNoAnswers(true),
      displayAnswer: 'Oui',
    });
  } else {
    pool.push({
      id: 'castleplayed:no',
      kind: 'castling_played',
      category: 'castling',
      factKey: 'castling_played:none',
      promptFr: 'Y a-t-il eu un roque dans la séquence ?',
      accepted: yesNoAnswers(false),
      displayAnswer: 'Non',
    });
  }

  for (const p of pieces) {
    if (p.captured || !p.currentSquare) continue;
    if (p.currentSquare === p.startSquare) continue;
    if (p.type === 'p' && p.currentSquare[1] === p.startSquare[1]) continue;
    const name = PIECE_FR[p.type];
    pool.push({
      id: `locate:${p.id}`,
      kind: 'locate_piece',
      category: 'location',
      factKey: `locate:${p.id}`,
      promptFr: `Où se trouve le ${name} ${colorAdj(p.color, name)} parti de ${p.startSquare} ?`,
      accepted: [
        p.currentSquare,
        `${name} ${p.currentSquare}`,
        `il est en ${p.currentSquare}`,
      ].map(normalizeAnswer),
      displayAnswer: p.currentSquare,
    });
  }

  const occupied = pieces.filter((p) => !p.captured && p.currentSquare);
  const squareCounts = new Map<string, number>();
  for (const p of occupied) {
    squareCounts.set(p.currentSquare!, (squareCounts.get(p.currentSquare!) ?? 0) + 1);
  }
  for (const p of occupied) {
    const sq = p.currentSquare!;
    if ((squareCounts.get(sq) ?? 0) !== 1) continue;
    const name = PIECE_FR[p.type];
    const phrase = piecePhrase(p);
    pool.push({
      id: `onsq:${sq}`,
      kind: 'piece_on_square',
      category: 'location',
      factKey: `piece_on:${sq}`,
      promptFr: `Quelle pièce se trouve en ${sq} ?`,
      accepted: [
        phrase,
        name,
        `${name} ${COLOR_FR[p.color]}`,
        englishPiece(p.type),
      ].map(normalizeAnswer),
      displayAnswer: phrase,
    });
    pool.push({
      id: `colsq:${sq}`,
      kind: 'color_on_square',
      category: 'location',
      factKey: `color_on:${sq}`,
      promptFr: `De quelle couleur est la pièce en ${sq} ?`,
      accepted: colorAnswers(p.color),
      displayAnswer: p.color === 'w' ? 'Blanc' : 'Noir',
    });
  }

  for (const p of pieces.filter((x) => x.type === 'p' || x.captured)) {
    const name = PIECE_FR[p.type];
    const yes = !p.captured;
    pool.push({
      id: `alive:${p.id}`,
      kind: 'still_on_board',
      category: 'piece_status',
      factKey: `alive:${p.id}`,
      promptFr: `Le ${name} ${colorAdj(p.color, name)} parti de ${p.startSquare} est-il encore sur l'échiquier ?`,
      accepted: (yes
        ? ['oui', 'yes', 'encore', 'toujours']
        : ['non', 'no', 'capture', 'capturee', 'capturé', 'il a été capturé', 'pris']
      ).map(normalizeAnswer),
      displayAnswer: yes ? 'Oui' : 'Non — il a été capturé',
    });
  }

  for (const type of ['n', 'r'] as const) {
    for (const color of ['w', 'b'] as const) {
      const remaining = pieces.filter((p) => p.type === type && p.color === color && !p.captured).length;
      if (remaining < 2) continue;
      const name = PIECE_FR[type];
      pool.push({
        id: `remain:${color}${type}`,
        kind: 'remaining_piece_type_count',
        category: 'piece_status',
        factKey: `remain:${color}:${type}`,
        promptFr: `Combien de ${name}s ${color === 'w' ? 'blancs' : 'noirs'} restent-ils sur l'échiquier ?`,
        accepted: [String(remaining)].map(normalizeAnswer),
        displayAnswer: String(remaining),
      });
    }
  }

  pool.push({
    id: 'stm',
    kind: 'side_to_move',
    category: 'position_state',
    factKey: 'side_to_move',
    promptFr: 'À qui est le trait ?',
    accepted: colorAnswers(analysis.sideToMove),
    displayAnswer: analysis.sideToMove === 'w' ? 'Blancs' : 'Noirs',
  });

  const checkColor = analysis.sideToMove;
  const inCheck = checkColor === 'w' ? analysis.whiteInCheck : analysis.blackInCheck;
  pool.push({
    id: 'check',
    kind: 'king_in_check',
    category: 'position_state',
    factKey: 'king_in_check',
    promptFr: `Le roi ${checkColor === 'w' ? 'blanc' : 'noir'} est-il en échec ?`,
    accepted: yesNoAnswers(inCheck),
    displayAnswer: inCheck ? 'Oui' : 'Non',
  });

  for (const color of ['w', 'b'] as const) {
    const count = pieces.filter((p) => p.color === color && !p.captured).length;
    pool.push({
      id: `pcount:${color}`,
      kind: 'piece_count_color',
      category: 'position_state',
      factKey: `piece_count:${color}`,
      promptFr: `Combien de pièces ${color === 'w' ? 'blanches' : 'noires'} restent sur l'échiquier ?`,
      accepted: [String(count)].map(normalizeAnswer),
      displayAnswer: String(count),
    });
  }

  for (const color of ['w', 'b'] as const) {
    const developed = countDeveloped(pieces, color);
    pool.push({
      id: `dev:${color}:${developed}`,
      kind: 'count_developed',
      category: 'development',
      factKey: `developed:${color}`,
      promptFr:
        color === 'w'
          ? 'Combien de pièces blanches (hors pions et roi) ont quitté leur case initiale ?'
          : 'Combien de pièces noires (hors pions et roi) ont quitté leur case initiale ?',
      accepted: [String(developed)].map(normalizeAnswer),
      displayAnswer: String(developed),
    });
  }

  for (const p of pieces) {
    const moves = analysis.moveCountByPieceId[p.id] ?? 0;
    if (moves <= 0 || p.type === 'p') continue;
    const name = PIECE_FR[p.type];
    pool.push({
      id: `mvcount:${p.id}`,
      kind: 'piece_move_count',
      category: 'development',
      factKey: `move_count:${p.id}`,
      promptFr: `Combien de fois le ${name} ${colorAdj(p.color, name)} parti de ${p.startSquare} a-t-il bougé ?`,
      accepted: [String(moves)].map(normalizeAnswer),
      displayAnswer: String(moves),
    });
  }

  if (analysis.whiteSans.length) {
    const firstMover = moverAt(analysis, 0);
    if (firstMover) {
      pool.push({
        id: 'firstwmover',
        kind: 'first_white_piece_moved',
        category: 'development',
        factKey: 'first_white_piece_moved',
        promptFr: 'Quelle pièce blanche a joué en premier ?',
        accepted: [
          piecePhrase(firstMover),
          PIECE_FR[firstMover.type],
          englishPiece(firstMover.type),
        ].map(normalizeAnswer),
        displayAnswer: piecePhrase(firstMover),
      });
    }
  }

  if (analysis.fenSnapshots.length >= 2) {
    const halfMove = 2;
    const fen = analysis.fenSnapshots[halfMove - 1];
    for (const p of pieces) {
      if (p.captured || p.type === 'p') continue;
      const square = squareAtHalfMove(analysis, p.id, halfMove);
      if (!square || square === p.currentSquare) continue;
      const name = PIECE_FR[p.type];
      pool.push({
        id: `temporal:${p.id}:${halfMove}`,
        kind: 'temporal_piece_location',
        category: 'temporal',
        factKey: `temporal_loc:${p.id}:${halfMove}`,
        promptFr: `Après le ${halfMove}e demi-coup, où se trouve le ${name} ${colorAdj(p.color, name)} parti de ${p.startSquare} ?`,
        accepted: [square, `il est en ${square}`].map(normalizeAnswer),
        displayAnswer: square,
      });
      break;
    }

    const probeSquare = 'e4';
    const occThen = pieceAtFen(fen, probeSquare);
    if (occThen) {
      pool.push({
        id: `tempsq:${probeSquare}:${halfMove}`,
        kind: 'temporal_square_occupancy',
        category: 'temporal',
        factKey: `temporal_sq:${probeSquare}:${halfMove}`,
        promptFr: `Après le ${halfMove}e demi-coup, quelle pièce se trouve en ${probeSquare} ?`,
        accepted: [
          piecePhraseFrom(occThen.type, occThen.color),
          PIECE_FR[occThen.type],
        ].map(normalizeAnswer),
        displayAnswer: piecePhraseFrom(occThen.type, occThen.color),
      });
    }
  }

  return pool;
}

const CATEGORY_ORDER: QuestionCategory[] = [
  'opening',
  'move_history',
  'captures',
  'castling',
  'location',
  'piece_status',
  'position_state',
  'development',
  'temporal',
];

function dedupePool(pool: PositionQuestion[]): PositionQuestion[] {
  const seen = new Set<string>();
  const out: PositionQuestion[] = [];
  for (const q of pool) {
    if (seen.has(q.factKey)) continue;
    seen.add(q.factKey);
    out.push(q);
  }
  return out;
}

function selectBalanced(
  pool: PositionQuestion[],
  maxQuestions: number,
  rng: () => number,
): PositionQuestion[] {
  const byCategory = new Map<QuestionCategory, PositionQuestion[]>();
  for (const cat of CATEGORY_ORDER) byCategory.set(cat, []);
  for (const q of pool) {
    const list = byCategory.get(q.category);
    if (list) list.push(q);
  }
  for (const list of byCategory.values()) {
    list.sort(() => rng() - 0.5);
  }

  const picked: PositionQuestion[] = [];
  const pickedFacts = new Set<string>();
  let round = 0;
  while (picked.length < maxQuestions && round < maxQuestions * 3) {
    let added = false;
    for (const cat of CATEGORY_ORDER) {
      if (picked.length >= maxQuestions) break;
      const list = byCategory.get(cat) ?? [];
      const q = list.find((item) => !pickedFacts.has(item.factKey));
      if (q) {
        picked.push(q);
        pickedFacts.add(q.factKey);
        added = true;
      }
    }
    if (!added) break;
    round += 1;
  }
  return picked;
}

/**
 * Build a short list of unambiguous questions for this position.
 */
export function generateQuestions(
  analysis: HistoryAnalysis,
  options: { maxQuestions?: number; rng?: () => number } = {},
): PositionQuestion[] {
  const max = options.maxQuestions ?? 10;
  const rng = options.rng ?? Math.random;
  const pool = dedupePool(buildQuestionPool(analysis));
  return selectBalanced(pool, max, rng);
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
