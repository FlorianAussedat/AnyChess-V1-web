/**
 * Visual / board-coordinate chess culture questions (FEN where useful).
 * Original AnyChess wording — bilingual FR + EN.
 */
import type { ChessCultureQuestion } from '../types.ts';
import { defineQuestion as q } from './_helpers.ts';

export const VISUAL_QUESTIONS: ChessCultureQuestion[] = [
  q({
    id: 'visual-001',
    category: 'visual',
    subcategory: 'coordinates',
    difficulty: 1,
    tags: ['coordinates', 'color'],
    question: 'De quelle couleur est la case e4 ?',
    answers: ['Claire (blanche)', 'Foncée (noire)', 'Cela dépend de l’orientation', 'Rouge'],
    correctAnswer: 0,
    explanation:
      'Avec a1 sombre à gauche pour les Blancs, e4 est une case claire.',
    presentation: {
      boardFen: '4k3/8/8/8/4P3/8/8/4K3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'What color is the square e4?',
      answers: ['Light (white)', 'Dark (black)', 'It depends on orientation', 'Red'],
      explanation:
        'With a1 dark for White, e4 is a light square.',
    },
  }),
  q({
    id: 'visual-002',
    category: 'visual',
    subcategory: 'coordinates',
    difficulty: 1,
    tags: ['coordinates', 'color'],
    question: 'De quelle couleur est la case d4 ?',
    answers: ['Foncée (noire)', 'Claire (blanche)', 'Cela change après le roque', 'Transparente'],
    correctAnswer: 0,
    explanation: 'd4 est une case foncée sur un échiquier orienté standard.',
    presentation: {
      boardFen: '4k3/8/8/8/3P4/8/8/4K3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'What color is the square d4?',
      answers: ['Dark (black)', 'Light (white)', 'It changes after castling', 'Transparent'],
      explanation: 'd4 is a dark square on a standard-oriented board.',
    },
  }),
  q({
    id: 'visual-003',
    category: 'visual',
    subcategory: 'check',
    difficulty: 2,
    tags: ['check'],
    question: 'Quel roi est en échec sur cette position ?',
    answers: ['Le roi noir', 'Le roi blanc', 'Les deux rois', 'Aucun'],
    correctAnswer: 0,
    explanation:
      'La tour blanche sur e1 attaque le roi noir sur e8 le long de la colonne e.',
    presentation: {
      boardFen: '4k3/8/8/8/8/8/8/4R2K w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which king is in check in this position?',
      answers: ['The black king', 'The white king', 'Both kings', 'Neither'],
      explanation:
        'The white rook on e1 attacks the black king on e8 along the e-file.',
    },
  }),
  q({
    id: 'visual-004',
    category: 'visual',
    subcategory: 'pin',
    difficulty: 2,
    tags: ['pin'],
    question: 'Quelle pièce noire est clouée ici ?',
    answers: ['Le cavalier en c6', 'Le pion en a7', 'Le roi en e8', 'La dame en d8'],
    correctAnswer: 0,
    explanation:
      'Le fou blanc en a4 vise le roi via la diagonale ; le cavalier en c6 ne peut pas bouger sans exposer le roi.',
    presentation: {
      boardFen: '4k3/8/2n5/8/B7/8/8/4K3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which black piece is pinned here?',
      answers: ['The knight on c6', 'The pawn on a7', 'The king on e8', 'The queen on d8'],
      explanation:
        'White’s bishop on a4 eyes the king along the diagonal; the knight on c6 cannot move without exposing the king.',
    },
  }),
  q({
    id: 'visual-005',
    category: 'visual',
    subcategory: 'open-file',
    difficulty: 2,
    tags: ['open-file'],
    question: 'Quelle colonne est ouverte (sans pion) ici ?',
    answers: ['La colonne e', 'La colonne d', 'La colonne a', 'La colonne h'],
    correctAnswer: 0,
    explanation: 'Aucun pion n’occupe la colonne e, ce qui en fait une colonne ouverte pour les tours.',
    presentation: {
      boardFen: '4r2k/pppp1ppp/8/8/8/8/PPPP1PPP/4R2K w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which file is open (pawnless) here?',
      answers: ['The e-file', 'The d-file', 'The a-file', 'The h-file'],
      explanation: 'No pawn sits on the e-file, so it is open for the rooks.',
    },
  }),
  q({
    id: 'visual-006',
    category: 'visual',
    subcategory: 'passed-pawn',
    difficulty: 3,
    tags: ['passed-pawn'],
    question: 'Quel pion blanc est passé ?',
    answers: ['Le pion en e5', 'Le pion en a2', 'Le pion en h2', 'Le pion en c3'],
    correctAnswer: 0,
    explanation:
      'Sur la route e6–e8, aucun pion noir ne peut bloquer ou capturer le pion e5 depuis une colonne voisine.',
    presentation: {
      boardFen: '4k3/p6p/8/4P3/8/8/P6P/4K3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which white pawn is passed?',
      answers: ['The pawn on e5', 'The pawn on a2', 'The pawn on h2', 'The pawn on c3'],
      explanation:
        'On the path e6–e8, no black pawn can block or capture the e5 pawn from an adjacent file.',
    },
  }),
  q({
    id: 'visual-007',
    category: 'visual',
    subcategory: 'bishop-pair',
    difficulty: 2,
    tags: ['bishop-pair'],
    question: 'Quel camp possède la paire de fous ?',
    answers: ['Les Blancs', 'Les Noirs', 'Les deux', 'Aucun'],
    correctAnswer: 0,
    explanation: 'Les Blancs ont encore les deux fous ; les Noirs n’en ont qu’un.',
    presentation: {
      boardFen: '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which side has the bishop pair?',
      answers: ['White', 'Black', 'Both', 'Neither'],
      explanation: 'White still has both bishops; Black has none in this diagram.',
    },
  }),
  q({
    id: 'visual-008',
    category: 'visual',
    subcategory: 'material',
    difficulty: 2,
    tags: ['material'],
    question: 'Quel camp a un avantage matériel net ici ?',
    answers: ['Les Blancs (une pièce)', 'Les Noirs', 'Égalité stricte', 'Les Blancs (deux pions)'],
    correctAnswer: 0,
    explanation: 'Les Blancs ont un cavalier de plus pour le même nombre de pions.',
    presentation: {
      boardFen: '4k3/4p3/8/8/8/8/4P3/3NK3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which side has a clear material advantage here?',
      answers: ['White (a piece)', 'Black', 'Dead equal', 'White (two pawns)'],
      explanation: 'White has an extra knight with equal pawns.',
    },
  }),
  q({
    id: 'visual-009',
    category: 'visual',
    subcategory: 'castling',
    difficulty: 2,
    tags: ['castling'],
    question: 'Les Blancs peuvent-ils encore roquer petit dans cette position ?',
    answers: [
      'Non — le chemin du roi n’est pas libre',
      'Oui — tout est prêt',
      'Oui — même avec échec',
      'Seulement en passant',
    ],
    correctAnswer: 0,
    explanation:
      'La case f1 est occupée ; le roi ne peut pas traverser ni arriver sur une case occupée pour le petit roque.',
    presentation: {
      boardFen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3KB1R w KQkq - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Can White still castle kingside in this position?',
      answers: [
        'No — the king’s path is not clear',
        'Yes — everything is ready',
        'Yes — even while in check',
        'Only en passant',
      ],
      explanation:
        'f1 is occupied; the king cannot cross or land on an occupied square for kingside castling.',
    },
  }),
  q({
    id: 'visual-010',
    category: 'visual',
    subcategory: 'promotion',
    difficulty: 2,
    tags: ['promotion'],
    question: 'Que peut devenir le pion blanc en a7 au prochain coup ?',
    answers: [
      'Dame, tour, fou ou cavalier (sur a8)',
      'Uniquement une dame',
      'Uniquement un cavalier',
      'Il ne peut pas promouvoir',
    ],
    correctAnswer: 0,
    explanation:
      'En avançant en a8, le pion doit se promouvoir en dame, tour, fou ou cavalier.',
    presentation: {
      boardFen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'What can White’s a7 pawn become on the next move?',
      answers: [
        'Queen, rook, bishop, or knight (on a8)',
        'Only a queen',
        'Only a knight',
        'It cannot promote',
      ],
      explanation:
        'By advancing to a8, the pawn must promote to a queen, rook, bishop, or knight.',
    },
  }),
  q({
    id: 'visual-011',
    category: 'visual',
    subcategory: 'fork',
    difficulty: 2,
    tags: ['fork'],
    question: 'Quelle tactique le cavalier blanc menace-t-il ici ?',
    answers: ['Une fourchette roi + dame', 'Un mat à l’étouffée', 'Un clouage absolu', 'En passant'],
    correctAnswer: 0,
    explanation:
      'Le cavalier en c7 attaque à la fois le roi en e8 et la dame en a8.',
    presentation: {
      boardFen: 'q3k3/2N5/8/8/8/8/8/4K3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'What tactic is White’s knight threatening here?',
      answers: ['A king + queen fork', 'A smothered mate', 'An absolute pin', 'En passant'],
      explanation:
        'The knight on c7 attacks both the king on e8 and the queen on a8.',
    },
  }),
  q({
    id: 'visual-012',
    category: 'visual',
    subcategory: 'stalemate',
    difficulty: 3,
    tags: ['stalemate'],
    question: 'Si c’est aux Noirs de jouer, quelle est la situation ?',
    answers: [
      'Pat (aucun coup légal, roi non en échec)',
      'Échec et mat',
      'Échec simple',
      'Les Noirs doivent capturer le roi',
    ],
    correctAnswer: 0,
    explanation:
      'Le roi noir n’est pas en échec mais n’a aucune case sûre, et aucun autre coup n’est possible : c’est un pat.',
    presentation: {
      boardFen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'If it is Black to move, what is the situation?',
      answers: [
        'Stalemate (no legal move, king not in check)',
        'Checkmate',
        'Simple check',
        'Black must capture the king',
      ],
      explanation:
        'The black king is not in check but has no safe square, and no other move exists: it is stalemate.',
    },
  }),
  q({
    id: 'visual-013',
    category: 'visual',
    subcategory: 'coordinates',
    difficulty: 1,
    tags: ['coordinates'],
    question: 'Sur quelle case se trouve le roi blanc ?',
    answers: ['e1', 'e8', 'a1', 'h1'],
    correctAnswer: 0,
    explanation: 'Avec les coordonnées visibles, le roi blanc est sur sa case de départ e1.',
    presentation: {
      boardFen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'On which square is the white king?',
      answers: ['e1', 'e8', 'a1', 'h1'],
      explanation: 'With coordinates shown, the white king sits on its starting square e1.',
    },
  }),
  q({
    id: 'visual-014',
    category: 'visual',
    subcategory: 'skewer',
    difficulty: 3,
    tags: ['skewer'],
    question: 'Quelle tactique la tour blanche exerce-t-elle sur la colonne a ?',
    answers: ['Une enfilade (roi devant, dame derrière)', 'Un clouage relatif', 'Un mat du couloir', 'Un gambit'],
    correctAnswer: 0,
    explanation:
      'Le roi en a8 est attaqué ; s’il s’écarte, la dame en a7 tombe : c’est une enfilade.',
    presentation: {
      boardFen: 'k7/q7/8/8/8/8/8/R3K3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'What tactic is White’s rook applying on the a-file?',
      answers: ['A skewer (king in front, queen behind)', 'A relative pin', 'A back-rank mate', 'A gambit'],
      explanation:
        'The king on a8 is attacked; if it steps aside, the queen on a7 falls — a skewer.',
    },
  }),
  q({
    id: 'visual-015',
    category: 'visual',
    subcategory: 'weak-square',
    difficulty: 3,
    tags: ['outpost', 'weak-square'],
    question: 'Quelle case est un excellent avant-poste pour un cavalier blanc ?',
    answers: ['d5', 'a2', 'h1', 'e1'],
    correctAnswer: 0,
    explanation:
      'd5 est soutenu par le pion e4 et ne peut plus être chassé par un pion noir (c6/e6 absents).',
    presentation: {
      boardFen: '4k3/pp3ppp/8/3N4/4P3/8/PPP2PPP/4K3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which square is an excellent outpost for a white knight?',
      answers: ['d5', 'a2', 'h1', 'e1'],
      explanation:
        'd5 is supported by the e4 pawn and cannot be chased by a black pawn (no c6/e6).',
    },
  }),
  q({
    id: 'visual-016',
    category: 'visual',
    subcategory: 'en-passant',
    difficulty: 3,
    tags: ['en-passant'],
    question: 'Les Blancs peuvent-ils prendre en passant ici ?',
    answers: [
      'Oui — capturer le pion d5 en c6',
      'Non — trop tard',
      'Oui — capturer en d6',
      'Non — seuls les Noirs le peuvent',
    ],
    correctAnswer: 0,
    explanation:
      'Le pion noir vient d’avancer de deux cases (d7–d5) à côté du pion c5 ; les Blancs peuvent capturer en passant en c6.',
    presentation: {
      boardFen: '4k3/8/8/2Pp4/8/8/8/4K3 w - d6 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Can White capture en passant here?',
      answers: [
        'Yes — capture the d5 pawn by moving to c6',
        'No — too late',
        'Yes — capture onto d6',
        'No — only Black can',
      ],
      explanation:
        'Black just advanced two squares (d7–d5) beside the c5 pawn; White may capture en passant onto c6.',
    },
  }),
];
