/**
 * Checkmate-pattern questions (many with illustrative FEN boards).
 * Original AnyChess wording — bilingual FR + EN.
 */
import type { ChessCultureQuestion } from '../types.ts';

type Draft = Omit<ChessCultureQuestion, 'revision' | 'active' | 'sourceType' | 'tags'> & {
  tags?: string[];
};

function q(draft: Draft): ChessCultureQuestion {
  return {
    revision: 1,
    active: true,
    sourceType: 'stable-fact',
    tags: draft.tags ?? ['checkmate', 'pattern'],
    ...draft,
  };
}

export const CHECKMATE_QUESTIONS: ChessCultureQuestion[] = [
  q({
    id: 'checkmates-001',
    category: 'checkmates',
    subcategory: 'smothered',
    difficulty: 2,
    question: 'Quel motif de mat est représenté sur l’échiquier ?',
    answers: ['Mat à l’étouffée', 'Mat du couloir', 'Mat de Boden', 'Mat d’Anastasie'],
    correctAnswer: 0,
    explanation:
      'Le mat à l’étouffée survient quand le roi est coincé par ses propres pièces et est maté, le plus souvent par un cavalier.',
    presentation: {
      boardFen: '5r1k/5Npp/8/8/8/8/8/7K w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which checkmate pattern is shown on the board?',
      answers: ['Smothered mate', 'Back-rank mate', "Boden's mate", "Anastasia's mate"],
      explanation:
        'A smothered mate occurs when the king is trapped by its own pieces and is usually mated by a knight.',
    },
  }),
  q({
    id: 'checkmates-002',
    category: 'checkmates',
    subcategory: 'back-rank',
    difficulty: 2,
    question: 'Quel motif de mat voit-on ici ?',
    answers: ['Mat du couloir', 'Mat à l’étouffée', 'Mat arabe', 'Mat des épaulettes'],
    correctAnswer: 0,
    explanation:
      'Le mat du couloir (back-rank mate) est donné sur la dernière rangée quand le roi adverse ne peut plus fuir derrière ses propres pions.',
    presentation: {
      boardFen: '4R1k1/5ppp/8/8/8/8/8/7K w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which mating pattern is shown here?',
      answers: ['Back-rank mate', 'Smothered mate', 'Arabian mate', 'Epaulette mate'],
      explanation:
        'A back-rank mate is delivered on the last rank when the enemy king cannot escape behind its own pawns.',
    },
  }),
  q({
    id: 'checkmates-003',
    category: 'checkmates',
    subcategory: 'scholars',
    difficulty: 1,
    question: 'Quelle est la position finale typique du « mat du berger » ?',
    answers: [
      'La dame blanche mate en f7',
      'La tour mate sur la 8e rangée',
      'Deux fous mate le roi au centre',
      'Un cavalier mate le roi étouffé',
    ],
    correctAnswer: 0,
    explanation:
      'Dans le mat du berger, les Blancs attaquent f7 rapidement (fou + dame) et matent souvent par Dxf7.',
    presentation: {
      boardFen: 'rnbqkbnr/pppp1Qpp/8/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'What is the typical final position of Scholar’s mate?',
      answers: [
        'White’s queen mates on f7',
        'A rook mates on the 8th rank',
        'Two bishops mate a central king',
        'A knight delivers smothered mate',
      ],
      explanation:
        'In Scholar’s mate, White attacks f7 quickly with bishop and queen, often mating with Qxf7.',
    },
  }),
  q({
    id: 'checkmates-004',
    category: 'checkmates',
    subcategory: 'fools',
    difficulty: 1,
    question: 'Comment s’appelle le mat ultra-rapide 1.f3 e5 2.g4 Dh4# ?',
    answers: ['Mat du fou', 'Mat du berger', 'Mat du couloir', 'Mat arabe'],
    correctAnswer: 0,
    explanation:
      'Le mat du fou (Fool’s mate) est le mat le plus rapide possible, après un affaiblissement suicidaire des cases autour du roi blanc.',
    presentation: {
      boardFen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'What is the ultra-fast mate 1.f3 e5 2.g4 Qh4# called?',
      answers: ["Fool's mate", "Scholar's mate", 'Back-rank mate', 'Arabian mate'],
      explanation:
        "Fool's mate is the fastest possible mate, after White fatally weakens the squares around the king.",
    },
  }),
  q({
    id: 'checkmates-005',
    category: 'checkmates',
    subcategory: 'arabian',
    difficulty: 3,
    question: 'Quel motif combine souvent tour sur la 7e/8e rangée et cavalier près du roi en coin ?',
    answers: ['Mat arabe', 'Mat de Boden', 'Mat des épaulettes', 'Mat du berger'],
    correctAnswer: 0,
    explanation:
      'Le mat arabe typique place le roi adverse dans un coin, contrôlé par un cavalier, tandis qu’une tour donne le coup final sur la bordure.',
    presentation: {
      boardFen: '7k/7R/5N2/8/8/8/8/7K w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which pattern often combines a rook on the 7th/8th rank with a knight near a cornered king?',
      answers: ['Arabian mate', "Boden's mate", 'Epaulette mate', "Scholar's mate"],
      explanation:
        'A typical Arabian mate cages the enemy king in a corner with a knight while a rook delivers the finishing check on the edge.',
    },
  }),
  q({
    id: 'checkmates-006',
    category: 'checkmates',
    subcategory: 'epaulette',
    difficulty: 3,
    question: 'Dans le mat des épaulettes, où se trouvent souvent les pièces du camp maté ?',
    answers: [
      'De chaque côté du roi, comme des épaulettes',
      'Devant le roi seulement',
      'Derrière le roi seulement',
      'Sur les cases de promotion',
    ],
    correctAnswer: 0,
    explanation:
      'Les « épaulettes » sont des pièces amies placées de part et d’autre du roi, qui lui bloquent les fuites latérales.',
    presentation: {
      boardFen: '3rkr2/8/4Q3/8/8/8/8/4K3 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'In an epaulette mate, where do the mated side’s pieces often stand?',
      answers: [
        'On both sides of the king, like epaulettes',
        'Only in front of the king',
        'Only behind the king',
        'On promotion squares',
      ],
      explanation:
        'The “epaulettes” are friendly pieces beside the king that block sideways flight squares.',
    },
  }),
  q({
    id: 'checkmates-007',
    category: 'checkmates',
    subcategory: 'anastasia',
    difficulty: 3,
    question: 'Quel motif utilise cavalier + tour pour coincer le roi sur le bord ?',
    answers: ['Mat d’Anastasie', 'Mat à l’étouffée', 'Mat du couloir', 'Mat du berger'],
    correctAnswer: 0,
    explanation:
      'Le mat d’Anastasie combine un cavalier qui coupe des cases de fuite et une tour qui mate le long du bord.',
    presentation: {
      boardFen: '4R1k1/5ppp/5N2/8/8/8/8/7K w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: 'Which pattern uses knight + rook to trap the king on the edge?',
      answers: ["Anastasia's mate", 'Smothered mate', 'Back-rank mate', "Scholar's mate"],
      explanation:
        "Anastasia's mate combines a knight cutting flight squares with a rook mating along the edge.",
    },
  }),
  q({
    id: 'checkmates-008',
    category: 'checkmates',
    subcategory: 'boden',
    difficulty: 4,
    question: 'Le mat de Boden est caractérisé par…',
    answers: [
      'Deux fous croisant leurs diagonales contre un roi peu abrité',
      'Deux tours sur la 7e rangée',
      'Dame et cavalier seulement',
      'Un pion qui mate en 7e',
    ],
    correctAnswer: 0,
    explanation:
      'Dans le mat de Boden, deux fous contrôlent des diagonales croisées qui privent le roi de cases de fuite.',
    presentation: {
      boardFen: '2kr4/1pp5/B7/5B2/8/8/8/2K5 w - - 0 1',
      showCoordinates: true,
    },
    i18nEn: {
      question: "Boden's mate is characterized by…",
      answers: [
        'Two bishops crossing diagonals against an exposed king',
        'Two rooks on the 7th rank',
        'Queen and knight only',
        'A pawn mating on the 7th',
      ],
      explanation:
        "In Boden's mate, two bishops control crossing diagonals that strip the king of flight squares.",
    },
  }),
  q({
    id: 'checkmates-009',
    category: 'checkmates',
    subcategory: 'smothered',
    difficulty: 2,
    question: 'Quelle pièce délivre le plus souvent le coup final d’un mat à l’étouffée ?',
    answers: ['Le cavalier', 'La tour', 'Le fou', 'Le pion'],
    correctAnswer: 0,
    explanation:
      'Le cavalier peut attaquer une case entourée de pièces sans être bloqué, d’où son rôle typique dans le mat à l’étouffée.',
    i18nEn: {
      question: 'Which piece most often delivers the final check in a smothered mate?',
      answers: ['The knight', 'The rook', 'The bishop', 'The pawn'],
      explanation:
        'A knight can attack a crowded square without being blocked, which is why it often finishes a smothered mate.',
    },
  }),
  q({
    id: 'checkmates-010',
    category: 'checkmates',
    subcategory: 'back-rank',
    difficulty: 2,
    question: 'Quelle défense simple évite souvent un mat du couloir ?',
    answers: [
      'Créer une « fenêtre » (Luft) pour le roi',
      'Échanger toutes les dames',
      'Roquer le plus tard possible',
      'Avancer seulement les cavaliers',
    ],
    correctAnswer: 0,
    explanation:
      'Avancer un pion devant le roi (h3/h6 ou g3/g6) crée une case de fuite et réduit fortement le risque de mat du couloir.',
    i18nEn: {
      question: 'Which simple defensive idea often prevents back-rank mate?',
      answers: [
        'Create “Luft” (an escape square) for the king',
        'Trade all the queens',
        'Castle as late as possible',
        'Only advance the knights',
      ],
      explanation:
        'Pushing a pawn in front of the king (h3/h6 or g3/g6) creates a flight square and sharply reduces back-rank dangers.',
    },
  }),
  q({
    id: 'checkmates-011',
    category: 'checkmates',
    subcategory: 'patterns',
    difficulty: 3,
    question: 'Quelle affirmation décrit le mieux un mat du couloir ?',
    answers: [
      'Le roi est maté sur sa rangée de départ, bloqué par ses propres pions',
      'Le roi est maté uniquement par un cavalier au centre',
      'Deux fous mate toujours le roi en a8',
      'Un pion mate forcément en passant',
    ],
    correctAnswer: 0,
    explanation:
      'Sans case de fuite derrière la rangée de pions, une lourde pièce adverse peut mater sur la dernière rangée.',
    i18nEn: {
      question: 'Which statement best describes a back-rank mate?',
      answers: [
        'The king is mated on its back rank, blocked by its own pawns',
        'The king is mated only by a central knight',
        'Two bishops always mate the king on a8',
        'A pawn must mate by en passant',
      ],
      explanation:
        'Without a flight square behind the pawn shield, a heavy piece can mate on the last rank.',
    },
  }),
  q({
    id: 'checkmates-012',
    category: 'checkmates',
    subcategory: 'scholars',
    difficulty: 1,
    question: 'Le mat du berger cible surtout quelle case fragile au début ?',
    answers: ['f7 (ou f2)', 'a4', 'h5', 'c3'],
    correctAnswer: 0,
    explanation:
      'f7/f2 n’est défendu que par le roi au départ, d’où la vulnérabilité exploitée par le mat du berger.',
    i18nEn: {
      question: 'Scholar’s mate mainly targets which fragile early square?',
      answers: ['f7 (or f2)', 'a4', 'h5', 'c3'],
      explanation:
        'At the start, f7/f2 is defended only by the king, which is why Scholar’s mate focuses there.',
    },
  }),
];
