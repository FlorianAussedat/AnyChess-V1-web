/**
 * Structured FR/EN rendering for mental-vision questions.
 * Game data (SAN, squares, opening names, counts) stay untranslated.
 */
import type { PieceColor } from './PositionHistoryAnalyzer.ts';

export type MentalQuestionKind = string;

export type MentalQuestionLike = {
  kind: MentalQuestionKind;
  promptFr: string;
  displayAnswer: string;
  fact?: MentalPromptFact;
};

function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type MentalPromptFact = {
  n?: number;
  square?: string;
  startSquare?: string;
  pieceType?: string;
  color?: PieceColor;
  castleSide?: 'kingside' | 'queenside';
  halfMove?: number;
  yes?: boolean;
};

export type AppMentalLanguage = 'fr' | 'en';

const PIECE: Record<AppMentalLanguage, Record<string, string>> = {
  fr: { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' },
  en: { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' },
};

function pieceName(lang: AppMentalLanguage, type: string): string {
  return PIECE[lang][type] ?? type;
}

function colorAdj(lang: AppMentalLanguage, color: PieceColor, type: string): string {
  const name = pieceName(lang, type);
  if (lang === 'en') return color === 'w' ? `white ${name}` : `black ${name}`;
  if (color === 'w') return name === 'dame' || name === 'tour' ? `${name} blanche` : `${name} blanc`;
  return name === 'dame' || name === 'tour' ? `${name} noire` : `${name} noir`;
}

function sideName(lang: AppMentalLanguage, color: PieceColor, plural = false): string {
  if (lang === 'en') return color === 'w' ? (plural ? 'White' : 'White') : plural ? 'Black' : 'Black';
  return color === 'w' ? (plural ? 'Blancs' : 'blanc') : plural ? 'Noirs' : 'noir';
}

function castleSide(lang: AppMentalLanguage, side: 'kingside' | 'queenside'): string {
  if (lang === 'en') return side === 'kingside' ? 'kingside' : 'queenside';
  return side === 'kingside' ? 'petit côté' : 'grand côté';
}

function ordinalFr(n: number): string {
  return n === 1 ? '1er' : `${n}e`;
}

function ordinalEn(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export function renderMentalPrompt(
  question: Pick<MentalQuestionLike, 'kind' | 'promptFr' | 'fact'>,
  language: AppMentalLanguage,
): string {
  const fact = question.fact ?? {};
  const kind = question.kind;
  if (language === 'fr' && question.promptFr) return question.promptFr;
  return renderKind(kind, fact, language) || question.promptFr;
}

function renderKind(
  kind: MentalQuestionKind,
  fact: MentalPromptFact,
  lang: AppMentalLanguage,
): string {
  const n = fact.n ?? 1;
  const sq = fact.square ?? '';
  const start = fact.startSquare ?? '';
  const type = fact.pieceType ?? 'p';
  const color = fact.color ?? 'w';
  const half = fact.halfMove ?? 2;
  const piece = colorAdj(lang, color, type);
  const article = lang === 'fr' ? `le ${piece}` : `the ${piece}`;

  if (lang === 'fr') {
    switch (kind) {
      case 'opening_id':
        return 'Quelle ouverture a été jouée ?';
      case 'nth_white_move':
        return `Quel est le ${ordinalFr(n)} coup des Blancs ?`;
      case 'nth_black_move':
        return `Quel est le ${ordinalFr(n)} coup des Noirs ?`;
      case 'last_white_move':
        return 'Quel est le dernier coup des Blancs ?';
      case 'last_black_move':
        return 'Quel est le dernier coup des Noirs ?';
      case 'last_sequence_move':
        return 'Quel est le dernier coup de la séquence ?';
      case 'last_piece_moved':
        return 'Quelle pièce a joué le dernier coup ?';
      case 'capture_count':
        return 'Combien de captures ont été jouées ?';
      case 'capture_count_by_color':
        return color === 'w'
          ? 'Combien de pièces blanches ont été capturées ?'
          : 'Combien de pièces noires ont été capturées ?';
      case 'first_capture':
        return 'Quelle pièce a été capturée en premier ?';
      case 'last_capture':
        return 'Quelle pièce a été capturée en dernier ?';
      case 'capture_order_nth':
        return `Quelle pièce a été capturée en ${ordinalFr(n)} position ?`;
      case 'who_captured_piece':
        return `Quelle pièce a capturé ${article} parti de ${start} ?`;
      case 'castling_rights':
        return `Les ${sideName('fr', color, true)} peuvent-ils encore roquer ${castleSide('fr', fact.castleSide ?? 'kingside')} ?`;
      case 'castling_played':
        return 'Y a-t-il eu un roque dans la séquence ?';
      case 'castling_side':
        return `Les ${sideName('fr', color, true)} ont-ils roqué ${castleSide('fr', fact.castleSide ?? 'kingside')} ?`;
      case 'locate_piece':
        return `Où se trouve ${article} parti de ${start} ?`;
      case 'piece_on_square':
        return `Quelle pièce se trouve en ${sq} ?`;
      case 'color_on_square':
        return `De quelle couleur est la pièce en ${sq} ?`;
      case 'still_on_board':
        return `${article.charAt(0).toUpperCase()}${article.slice(1)} parti de ${start} est-il encore sur l'échiquier ?`;
      case 'remaining_piece_type_count':
        return `Combien de ${pieceName('fr', type)}s ${color === 'w' ? 'blancs' : 'noirs'} restent-ils sur l'échiquier ?`;
      case 'side_to_move':
        return 'À qui est le trait ?';
      case 'king_in_check':
        return `Le roi ${color === 'w' ? 'blanc' : 'noir'} est-il en échec ?`;
      case 'piece_count_color':
        return `Combien de pièces ${color === 'w' ? 'blanches' : 'noires'} restent sur l'échiquier ?`;
      case 'count_developed':
        return color === 'w'
          ? 'Combien de pièces blanches (hors pions et roi) ont quitté leur case initiale ?'
          : 'Combien de pièces noires (hors pions et roi) ont quitté leur case initiale ?';
      case 'piece_move_count':
        return `Combien de fois ${article} parti de ${start} a-t-il bougé ?`;
      case 'first_white_piece_moved':
        return 'Quelle pièce blanche a joué en premier ?';
      case 'temporal_piece_location':
        return `Après le ${ordinalFr(half)} demi-coup, où se trouve ${article} parti de ${start} ?`;
      case 'temporal_square_occupancy':
        return `Après le ${ordinalFr(half)} demi-coup, quelle pièce se trouve en ${sq} ?`;
      default:
        return '';
    }
  }

  switch (kind) {
    case 'opening_id':
      return 'Which opening was played?';
    case 'nth_white_move':
      return `What was White's ${ordinalEn(n)} move?`;
    case 'nth_black_move':
      return `What was Black's ${ordinalEn(n)} move?`;
    case 'last_white_move':
      return "What was White's last move?";
    case 'last_black_move':
      return "What was Black's last move?";
    case 'last_sequence_move':
      return 'What was the last move of the sequence?';
    case 'last_piece_moved':
      return 'Which piece played the last move?';
    case 'capture_count':
      return 'How many captures were played?';
    case 'capture_count_by_color':
      return color === 'w'
        ? 'How many white pieces were captured?'
        : 'How many black pieces were captured?';
    case 'first_capture':
      return 'Which piece was captured first?';
    case 'last_capture':
      return 'Which piece was captured last?';
    case 'capture_order_nth':
      return `Which piece was captured ${ordinalEn(n)}?`;
    case 'who_captured_piece':
      return `Which piece captured the ${piece} that started on ${start}?`;
    case 'castling_rights':
      return `Can ${sideName('en', color)} still castle ${castleSide('en', fact.castleSide ?? 'kingside')}?`;
    case 'castling_played':
      return 'Was there a castle in the sequence?';
    case 'castling_side':
      return `Did ${sideName('en', color)} castle ${castleSide('en', fact.castleSide ?? 'kingside')}?`;
    case 'locate_piece':
      return `Where is the ${piece} that started on ${start}?`;
    case 'piece_on_square':
      return `Which piece is on ${sq}?`;
    case 'color_on_square':
      return `What color is the piece on ${sq}?`;
    case 'still_on_board':
      return `Is the ${piece} that started on ${start} still on the board?`;
    case 'remaining_piece_type_count':
      return `How many ${color === 'w' ? 'white' : 'black'} ${pieceName('en', type)}s remain on the board?`;
    case 'side_to_move':
      return 'Who is to move?';
    case 'king_in_check':
      return `Is the ${color === 'w' ? 'white' : 'black'} king in check?`;
    case 'piece_count_color':
      return `How many ${color === 'w' ? 'white' : 'black'} pieces remain on the board?`;
    case 'count_developed':
      return color === 'w'
        ? 'How many white pieces (not pawns or the king) have left their starting square?'
        : 'How many black pieces (not pawns or the king) have left their starting square?';
    case 'piece_move_count':
      return `How many times has the ${piece} that started on ${start} moved?`;
    case 'first_white_piece_moved':
      return 'Which white piece moved first?';
    case 'temporal_piece_location':
      return `After the ${ordinalEn(half)} half-move, where is the ${piece} that started on ${start}?`;
    case 'temporal_square_occupancy':
      return `After the ${ordinalEn(half)} half-move, which piece is on ${sq}?`;
    default:
      return '';
  }
}

export function renderMentalDisplayAnswer(
  question: MentalQuestionLike,
  language: AppMentalLanguage,
): string {
  const fact = question.fact ?? {};
  if (question.kind === 'still_on_board') {
    if (fact.yes === false) {
      return language === 'en' ? 'No — it was captured' : 'Non — il a été capturé';
    }
    return language === 'en' ? 'Yes' : 'Oui';
  }
  if (
    question.kind === 'castling_rights' ||
    question.kind === 'castling_played' ||
    question.kind === 'castling_side' ||
    question.kind === 'king_in_check'
  ) {
    const yes =
      fact.yes ??
      ['oui', 'yes', 'vrai', 'true'].includes(normalizeAnswer(question.displayAnswer));
    return yes ? (language === 'en' ? 'Yes' : 'Oui') : language === 'en' ? 'No' : 'Non';
  }
  if (question.kind === 'side_to_move' || question.kind === 'color_on_square') {
    const white = question.displayAnswer.toLowerCase().startsWith('blanc') ||
      question.displayAnswer.toLowerCase().startsWith('white');
    if (question.kind === 'side_to_move') {
      return white
        ? language === 'en' ? 'White' : 'Blancs'
        : language === 'en' ? 'Black' : 'Noirs';
    }
    return white
      ? language === 'en' ? 'White' : 'Blanc'
      : language === 'en' ? 'Black' : 'Noir';
  }
  if (fact.pieceType && /^(pion|cavalier|fou|tour|dame|roi|pawn|knight|bishop|rook|queen|king)/i.test(question.displayAnswer)) {
    if (fact.color) return colorAdj(language, fact.color, fact.pieceType);
    return pieceName(language, fact.pieceType);
  }
  return question.displayAnswer;
}

export function inferMentalFact(
  kind: MentalQuestionKind,
  factKey: string,
  displayAnswer?: string,
  promptFr?: string,
): MentalPromptFact {
  const fact: MentalPromptFact = {};
  const pieceId = factKey.match(/([wb])([pnbrqk]):([a-h][1-8])/i);
  if (pieceId) {
    fact.color = pieceId[1]!.toLowerCase() as PieceColor;
    fact.pieceType = pieceId[2]!.toLowerCase();
    fact.startSquare = pieceId[3]!.toLowerCase();
  }
  const nth = factKey.match(/(?:nth_white|nth_black|capture_nth):(\d+)/);
  if (nth) fact.n = Number(nth[1]);
  const square = factKey.match(/(?:piece_on|color_on|temporal_sq):([a-h][1-8])/i);
  if (square) fact.square = square[1]!.toLowerCase();
  const remain = factKey.match(/^remain:([wb]):([pnbrqk])/i);
  if (remain) {
    fact.color = remain[1]!.toLowerCase() as PieceColor;
    fact.pieceType = remain[2]!.toLowerCase();
  }
  const half = factKey.match(/temporal_(?:loc|sq):.+:(\d+)$/);
  if (half) fact.halfMove = Number(half[1]);
  if (factKey.includes('white') && !fact.color) fact.color = 'w';
  if (factKey.includes('black') && !fact.color) fact.color = 'b';
  if (kind === 'piece_count_color' || kind === 'count_developed' || kind === 'capture_count_by_color') {
    if (factKey.includes('white') || /:w$/.test(factKey) || factKey.endsWith(':w')) fact.color = 'w';
    if (factKey.includes('black') || /:b$/.test(factKey) || factKey.endsWith(':b')) fact.color = 'b';
  }
  if (factKey.includes('kingside')) fact.castleSide = 'kingside';
  if (factKey.includes('queenside')) fact.castleSide = 'queenside';
  const side = factKey.match(/castling_side:([wb]):(kingside|queenside)/);
  if (side) {
    fact.color = side[1] as PieceColor;
    fact.castleSide = side[2] as 'kingside' | 'queenside';
  }
  if (kind === 'king_in_check') {
    const src = `${promptFr ?? ''} ${displayAnswer ?? ''}`;
    if (/noir|black/i.test(src)) fact.color = 'b';
    else if (/blanc|white/i.test(src)) fact.color = 'w';
  }
  if (displayAnswer && /^[a-h][1-8]$/.test(displayAnswer)) {
    fact.square = displayAnswer;
  }
  if (displayAnswer) {
    const yes = /^(oui|yes)/i.test(displayAnswer);
    const no = /^(non|no)/i.test(displayAnswer);
    if (yes) fact.yes = true;
    if (no) fact.yes = false;
  }
  if (
    kind === 'piece_on_square' ||
    kind === 'last_piece_moved' ||
    kind === 'first_white_piece_moved' ||
    kind === 'first_capture' ||
    kind === 'last_capture' ||
    kind === 'capture_order_nth' ||
    kind === 'who_captured_piece' ||
    kind === 'temporal_square_occupancy'
  ) {
    const mapped = Object.entries(PIECE.fr).find(([, name]) =>
      displayAnswer?.toLowerCase().includes(name),
    );
    if (mapped) fact.pieceType = mapped[0];
    if (displayAnswer && /blanc|white/i.test(displayAnswer)) fact.color = 'w';
    if (displayAnswer && /noir|black/i.test(displayAnswer)) fact.color = 'b';
  }
  return fact;
}

export function mentalAnswerSynonyms(fact: MentalPromptFact = {}): string[] {
  const extra: string[] = [];
  if (fact.pieceType) {
    extra.push(pieceName('fr', fact.pieceType), pieceName('en', fact.pieceType));
    if (fact.color) {
      extra.push(colorAdj('fr', fact.color, fact.pieceType), colorAdj('en', fact.color, fact.pieceType));
    }
  }
  if (fact.square) {
    extra.push(fact.square, `il est en ${fact.square}`, `it is on ${fact.square}`, `on ${fact.square}`);
  }
  if (fact.yes === true) extra.push('oui', 'yes', 'vrai', 'true', 'encore', 'toujours', 'still');
  if (fact.yes === false) {
    extra.push('non', 'no', 'faux', 'false', 'capture', 'captured', 'pris', 'taken');
  }
  return extra.map(normalizeAnswer);
}
