/**
 * Practical rules questions (Laws of Chess oriented).
 * Original AnyChess wording — bilingual FR + EN.
 */
import type { ChessCultureQuestion } from '../types.ts';
import { defineQuestion as q } from './_helpers.ts';

export const RULES_QUESTIONS: ChessCultureQuestion[] = [
  q({
    id: 'rules-new-001',
    category: 'rules',
    subcategory: 'castling',
    difficulty: 2,
    tags: ['castling'],
    sourceType: 'rule',
    question: 'Quand le roque est-il interdit ?',
    answers: [
      'Si le roi est en échec, doit traverser une case attaquée, ou a déjà bougé',
      'Si l’adversaire a encore sa dame',
      'Uniquement en blitz',
      'Si tous les pions ont avancé',
    ],
    correctAnswer: 0,
    explanation:
      'Le roi ne peut pas roquer hors de, à travers, ou dans un échec ; roi et tour concernés ne doivent pas avoir bougé.',
    i18nEn: {
      question: 'When is castling forbidden?',
      answers: [
        'If the king is in check, would cross an attacked square, or has already moved',
        'If the opponent still has a queen',
        'Only in blitz',
        'If all pawns have advanced',
      ],
      explanation:
        'The king may not castle out of, through, or into check; the king and that rook must not have moved.',
    },
  }),
  q({
    id: 'rules-new-002',
    category: 'rules',
    subcategory: 'en-passant',
    difficulty: 2,
    tags: ['en-passant'],
    sourceType: 'rule',
    question: 'Quand peut-on capturer en passant ?',
    answers: [
      'Immédiatement après qu’un pion adverse a avancé de deux cases à côté du vôtre',
      'À n’importe quel moment de la partie',
      'Seulement après le 40e coup',
      'Uniquement si le roi a roqué',
    ],
    correctAnswer: 0,
    explanation:
      'La prise en passant doit être jouée au coup suivant, sinon le droit disparaît.',
    i18nEn: {
      question: 'When may you capture en passant?',
      answers: [
        'Immediately after an enemy pawn advances two squares beside yours',
        'At any moment in the game',
        'Only after move 40',
        'Only if the king has castled',
      ],
      explanation:
        'En passant must be played on the next move, or the right disappears.',
    },
  }),
  q({
    id: 'rules-new-003',
    category: 'rules',
    subcategory: 'stalemate',
    difficulty: 2,
    tags: ['stalemate'],
    sourceType: 'rule',
    question: 'Qu’est-ce que le pat ?',
    answers: [
      'Le camp au trait n’a aucun coup légal et son roi n’est pas en échec : partie nulle',
      'Échec et mat forcé',
      'Une capture obligatoire',
      'Une promotion refusée',
    ],
    correctAnswer: 0,
    explanation:
      'Le pat termine la partie par nulle, même si l’adversaire a un avantage matériel énorme.',
    i18nEn: {
      question: 'What is stalemate?',
      answers: [
        'The side to move has no legal move and the king is not in check: the game is drawn',
        'Forced checkmate',
        'A mandatory capture',
        'A refused promotion',
      ],
      explanation:
        'Stalemate ends the game as a draw, even if the opponent has a huge material advantage.',
    },
  }),
  q({
    id: 'rules-new-004',
    category: 'rules',
    subcategory: 'insufficient-material',
    difficulty: 3,
    tags: ['draw', 'insufficient-material'],
    sourceType: 'rule',
    question: 'Laquelle de ces fins est une nulle typique pour matériel insuffisant ?',
    answers: [
      'Roi + fou contre roi (mêmes couleurs de cases impossibles à mater seuls)',
      'Roi + dame contre roi',
      'Roi + tour contre roi',
      'Roi + deux dames contre roi',
    ],
    correctAnswer: 0,
    explanation:
      'Roi + fou (ou roi + cavalier) contre roi seul ne peut pas forcer le mat : nulle par matériel insuffisant.',
    i18nEn: {
      question: 'Which ending is a typical draw by insufficient material?',
      answers: [
        'King + bishop vs king (cannot force mate alone)',
        'King + queen vs king',
        'King + rook vs king',
        'King + two queens vs king',
      ],
      explanation:
        'King + bishop (or king + knight) versus bare king cannot force mate: draw by insufficient material.',
    },
  }),
  q({
    id: 'rules-new-005',
    category: 'rules',
    subcategory: 'promotion',
    difficulty: 1,
    tags: ['promotion'],
    sourceType: 'rule',
    question: 'Que doit faire un pion qui atteint la dernière rangée ?',
    answers: [
      'Se promouvoir immédiatement en dame, tour, fou ou cavalier',
      'Rester pion jusqu’au coup suivant',
      'Disparaître du plateau',
      'Devenir un second roi',
    ],
    correctAnswer: 0,
    explanation:
      'La promotion est obligatoire dès l’arrivée sur la dernière rangée ; on choisit parmi les quatre pièces.',
    i18nEn: {
      question: 'What must a pawn do when it reaches the last rank?',
      answers: [
        'Promote immediately to a queen, rook, bishop, or knight',
        'Stay a pawn until the next move',
        'Leave the board',
        'Become a second king',
      ],
      explanation:
        'Promotion is mandatory on reaching the last rank; you choose among the four pieces.',
    },
  }),
  q({
    id: 'rules-new-006',
    category: 'rules',
    subcategory: 'fifty-move',
    difficulty: 3,
    tags: ['fifty-move-rule'],
    sourceType: 'rule',
    question: 'Que dit la règle des 50 coups (idée générale) ?',
    answers: [
      'On peut réclamer nulle si 50 coups consécutifs sans prise ni coup de pion',
      'La partie s’arrête automatiquement après 50 coups au total',
      'Chaque joueur a 50 minutes maximum',
      'On doit promouvoir avant le 50e coup',
    ],
    correctAnswer: 0,
    explanation:
      'Sans capture ni avance de pion pendant 50 coups de chaque camp, une nulle peut être réclamée (lois FIDE).',
    i18nEn: {
      question: 'What does the 50-move rule say (in general)?',
      answers: [
        'A draw may be claimed after 50 consecutive moves with no capture or pawn move',
        'The game stops automatically after 50 moves total',
        'Each player has 50 minutes maximum',
        'You must promote before move 50',
      ],
      explanation:
        'With no capture or pawn move for 50 moves by each side, a draw may be claimed (FIDE Laws).',
    },
  }),
  q({
    id: 'rules-new-007',
    category: 'rules',
    subcategory: 'repetition',
    difficulty: 2,
    tags: ['threefold-repetition'],
    sourceType: 'rule',
    question: 'Qu’est-ce qu’une nulle par répétition (idée générale) ?',
    answers: [
      'La même position s’est présentée au moins trois fois avec le même joueur au trait et les mêmes droits',
      'Trois échecs consécutifs',
      'Trois promotions',
      'Trois roques dans la partie',
    ],
    correctAnswer: 0,
    explanation:
      'La répétition triple (mêmes droits de roque/en passant) permet de réclamer la nulle.',
    i18nEn: {
      question: 'What is a draw by repetition (in general)?',
      answers: [
        'The same position has appeared at least three times with the same side to move and the same rights',
        'Three consecutive checks',
        'Three promotions',
        'Three castles in the game',
      ],
      explanation:
        'Threefold repetition (including castling/en passant rights) allows a draw claim.',
    },
  }),
  q({
    id: 'rules-new-008',
    category: 'rules',
    subcategory: 'king',
    difficulty: 1,
    tags: ['king-movement'],
    sourceType: 'rule',
    question: 'Comment le roi se déplace-t-il ?',
    answers: [
      'D’une case dans n’importe quelle direction (sauf roque)',
      'Comme une dame',
      'Uniquement en diagonal',
      'De deux cases toujours',
    ],
    correctAnswer: 0,
    explanation:
      'Hors roque, le roi avance d’une seule case ; il ne peut pas se placer en échec.',
    i18nEn: {
      question: 'How does the king move?',
      answers: [
        'One square in any direction (except when castling)',
        'Like a queen',
        'Only diagonally',
        'Always two squares',
      ],
      explanation:
        'Aside from castling, the king moves one square; it may not step into check.',
    },
  }),
  q({
    id: 'rules-new-009',
    category: 'rules',
    subcategory: 'check',
    difficulty: 2,
    tags: ['check'],
    sourceType: 'rule',
    question: 'Que doit faire un joueur dont le roi est en échec ?',
    answers: [
      'Parer l’échec immédiatement (fuir, capturer ou interposer si possible)',
      'Ignorer l’échec un coup',
      'Roquer pour sortir obligatoirement',
      'Passer son tour',
    ],
    correctAnswer: 0,
    explanation:
      'Tout coup qui laisse le roi en échec est illégal ; il faut résoudre la menace au coup même.',
    i18nEn: {
      question: 'What must a player do when their king is in check?',
      answers: [
        'Get out of check immediately (flee, capture, or interpose if possible)',
        'Ignore check for one move',
        'Castle as the only option',
        'Pass the turn',
      ],
      explanation:
        'Any move that leaves the king in check is illegal; the threat must be resolved that move.',
    },
  }),
  q({
    id: 'rules-new-010',
    category: 'rules',
    subcategory: 'underpromotion',
    difficulty: 2,
    tags: ['underpromotion'],
    sourceType: 'rule',
    question: 'Qu’est-ce qu’une sous-promotion ?',
    answers: [
      'Promouvoir en tour, fou ou cavalier plutôt qu’en dame',
      'Refuser de promouvoir',
      'Promouvoir deux pions d’un coup',
      'Échanger une dame contre un pion',
    ],
    correctAnswer: 0,
    explanation:
      'On sous-promouvoir parfois pour éviter un pat ou pour donner un échec de cavalier décisif.',
    i18nEn: {
      question: 'What is underpromotion?',
      answers: [
        'Promoting to a rook, bishop, or knight instead of a queen',
        'Refusing to promote',
        'Promoting two pawns at once',
        'Trading a queen for a pawn',
      ],
      explanation:
        'Players sometimes underpromote to avoid stalemate or to deliver a decisive knight check.',
    },
  }),
  q({
    id: 'rules-new-011',
    category: 'rules',
    subcategory: 'perpetual',
    difficulty: 2,
    tags: ['perpetual-check'],
    sourceType: 'rule',
    question: 'Qu’est-ce qu’un échec perpétuel (idée pratique) ?',
    answers: [
      'Une série d’échecs que l’adversaire ne peut éviter sans perte, menant souvent à la nulle',
      'Un mat forcé en un coup',
      'Un coup illégal répété',
      'Un roque répété',
    ],
    correctAnswer: 0,
    explanation:
      'L’échec perpétuel est une ressource défensive classique menant à la nulle (souvent via répétition).',
    i18nEn: {
      question: 'What is perpetual check (as a practical idea)?',
      answers: [
        'A series of checks the opponent cannot escape without loss, often leading to a draw',
        'A forced mate in one',
        'A repeated illegal move',
        'Repeated castling',
      ],
      explanation:
        'Perpetual check is a classic defensive resource that often leads to a draw (frequently via repetition).',
    },
  }),
];
