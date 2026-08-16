/**
 * Opening-recognition and basic idea questions.
 * Original AnyChess wording — bilingual FR + EN.
 */
import type { ChessCultureQuestion } from '../types.ts';
import { defineQuestion as q } from './_helpers.ts';

export const OPENINGS_QUESTIONS: ChessCultureQuestion[] = [
  q({
    id: 'openings-new-001',
    category: 'openings',
    subcategory: 'sicilian',
    difficulty: 1,
    tags: ['sicilian', '1.e4'],
    question: 'Quelle ouverture commence par 1.e4 c5 ?',
    answers: [
      'La défense sicilienne',
      'La défense française',
      'La Caro-Kann',
      'Le gambit du roi',
    ],
    correctAnswer: 0,
    explanation:
      '1…c5 caractérise la sicilienne : les Noirs combattent pour la case d4 avec un pion aile.',
    i18nEn: {
      question: 'Which opening begins 1.e4 c5?',
      answers: [
        'The Sicilian Defense',
        'The French Defense',
        'The Caro-Kann',
        "The King's Gambit",
      ],
      explanation:
        '1…c5 characterizes the Sicilian: Black fights for d4 with a wing pawn.',
    },
  }),
  q({
    id: 'openings-new-002',
    category: 'openings',
    subcategory: 'french',
    difficulty: 1,
    tags: ['french', '1.e4'],
    question: 'Quelle ouverture commence par 1.e4 e6 ?',
    answers: [
      'La défense française',
      'La sicilienne',
      'La défense Alekhine',
      'Le début Réti',
    ],
    correctAnswer: 0,
    explanation:
      'La française prépare …d5 tout en solidifiant le centre, au prix d’un fou c8 parfois passif.',
    i18nEn: {
      question: 'Which opening begins 1.e4 e6?',
      answers: [
        'The French Defense',
        'The Sicilian',
        'Alekhine’s Defense',
        'The Réti Opening',
      ],
      explanation:
        'The French prepares …d5 while solidifying the center, sometimes at the cost of a passive c8-bishop.',
    },
  }),
  q({
    id: 'openings-new-003',
    category: 'openings',
    subcategory: 'caro-kann',
    difficulty: 1,
    tags: ['caro-kann'],
    question: 'Quelle ouverture commence par 1.e4 c6 ?',
    answers: [
      'La défense Caro-Kann',
      'La défense Pirc',
      'Le gambit danois',
      'La défense Philidor',
    ],
    correctAnswer: 0,
    explanation:
      'La Caro-Kann prépare …d5 avec un pion c, souvent plus solide que la française pour le fou c8.',
    i18nEn: {
      question: 'Which opening begins 1.e4 c6?',
      answers: [
        'The Caro-Kann Defense',
        'The Pirc Defense',
        'The Danish Gambit',
        'The Philidor Defense',
      ],
      explanation:
        'The Caro-Kann prepares …d5 with a c-pawn, often freer for the c8-bishop than the French.',
    },
  }),
  q({
    id: 'openings-new-004',
    category: 'openings',
    subcategory: 'kings-indian',
    difficulty: 2,
    tags: ['kings-indian', '1.d4'],
    question: 'Quelle ouverture est caractérisée par 1.d4 Cf6 2.c4 g6 3.Cc3 Fg7 ?',
    answers: [
      'La défense indienne du roi',
      'La défense française',
      'La Caro-Kann',
      'Le gambit dame accepté',
    ],
    correctAnswer: 0,
    explanation:
      'L’indienne du roi laisse souvent le centre aux Blancs pour contre-attaquer ensuite (…e5 ou …c5).',
    i18nEn: {
      question: 'Which opening is characterized by 1.d4 Nf6 2.c4 g6 3.Nc3 Bg7?',
      answers: [
        "The King's Indian Defense",
        'The French Defense',
        'The Caro-Kann Defense',
        "The Queen's Gambit Accepted",
      ],
      explanation:
        'The King’s Indian often concedes the center early to strike back later with …e5 or …c5.',
    },
  }),
  q({
    id: 'openings-new-005',
    category: 'openings',
    subcategory: 'queens-gambit',
    difficulty: 2,
    tags: ['queens-gambit'],
    question: 'Comment s’appelle 1.d4 d5 2.c4 ?',
    answers: [
      'Le gambit dame',
      'Le gambit du roi',
      'Le début anglais',
      'La partie espagnole',
    ],
    correctAnswer: 0,
    explanation:
      'Le gambit dame propose le pion c pour presser le centre noir ; accepter ou refuser mène à des structures différentes.',
    i18nEn: {
      question: 'What is 1.d4 d5 2.c4 called?',
      answers: [
        "The Queen's Gambit",
        "The King's Gambit",
        'The English Opening',
        'The Ruy Lopez',
      ],
      explanation:
        'The Queen’s Gambit offers the c-pawn to pressure Black’s center; accepting or declining leads to different structures.',
    },
  }),
  q({
    id: 'openings-new-006',
    category: 'openings',
    subcategory: 'ruy-lopez',
    difficulty: 2,
    tags: ['ruy-lopez', 'spanish'],
    question: 'Quelle ouverture suit souvent 1.e4 e5 2.Cf3 Cc6 3.Fb5 ?',
    answers: [
      'La partie espagnole (Ruy Lopez)',
      'La partie italienne',
      'La sicilienne Najdorf',
      'Le gambit Evans',
    ],
    correctAnswer: 0,
    explanation:
      '3.Fb5 définit l’espagnole : pression sur le cavalier c6 et le centre e5.',
    i18nEn: {
      question: 'Which opening often continues 1.e4 e5 2.Nf3 Nc6 3.Bb5?',
      answers: [
        'The Ruy Lopez (Spanish Game)',
        'The Italian Game',
        'The Najdorf Sicilian',
        'The Evans Gambit',
      ],
      explanation:
        '3.Bb5 defines the Ruy Lopez: pressure on the c6-knight and the e5-center.',
    },
  }),
  q({
    id: 'openings-new-007',
    category: 'openings',
    subcategory: 'italian',
    difficulty: 2,
    tags: ['italian'],
    question: 'Quelle ouverture suit souvent 1.e4 e5 2.Cf3 Cc6 3.Fc4 ?',
    answers: [
      'La partie italienne',
      'La Caro-Kann',
      'La défense scandinave',
      'Le début Bird',
    ],
    correctAnswer: 0,
    explanation:
      '3.Fc4 vise f7 et mène à des structures ouvertes classiques (Giuoco Piano, Two Knights, etc.).',
    i18nEn: {
      question: 'Which opening often continues 1.e4 e5 2.Nf3 Nc6 3.Bc4?',
      answers: [
        'The Italian Game',
        'The Caro-Kann',
        'The Scandinavian Defense',
        "Bird's Opening",
      ],
      explanation:
        '3.Bc4 eyes f7 and leads to classic open structures (Giuoco Piano, Two Knights, etc.).',
    },
  }),
  q({
    id: 'openings-new-008',
    category: 'openings',
    subcategory: 'english',
    difficulty: 2,
    tags: ['english'],
    question: 'Comment s’appelle l’ouverture 1.c4 ?',
    answers: [
      'Le début anglais',
      'Le gambit du centre',
      'La défense hollandaise',
      'La partie viennoise',
    ],
    correctAnswer: 0,
    explanation:
      '1.c4 (anglais) contrôle d5 dès le premier coup et peut transposer vers des structures de type indienne ou sicilienne inversée.',
    i18nEn: {
      question: 'What is the opening 1.c4 called?',
      answers: [
        'The English Opening',
        'The Center Gambit',
        'The Dutch Defense',
        'The Vienna Game',
      ],
      explanation:
        '1.c4 (English) fights for d5 immediately and can transpose to Indian or reversed-Sicilian structures.',
    },
  }),
  q({
    id: 'openings-new-009',
    category: 'openings',
    subcategory: 'scandinavian',
    difficulty: 2,
    tags: ['scandinavian'],
    question: 'Quelle ouverture commence par 1.e4 d5 ?',
    answers: [
      'La défense scandinave',
      'La défense Pirc',
      'La défense Grunfeld',
      'Le gambit Blackmar-Diemer',
    ],
    correctAnswer: 0,
    explanation:
      'La scandinave force immédiatement le contact central ; après 2.exd5, les Noirs récupèrent souvent avec …Dxd5 ou …Cf6.',
    i18nEn: {
      question: 'Which opening begins 1.e4 d5?',
      answers: [
        'The Scandinavian Defense',
        'The Pirc Defense',
        'The Grünfeld Defense',
        'The Blackmar-Diemer Gambit',
      ],
      explanation:
        'The Scandinavian forces immediate central contact; after 2.exd5 Black usually recovers with …Qxd5 or …Nf6.',
    },
  }),
  q({
    id: 'openings-new-010',
    category: 'openings',
    subcategory: 'ideas',
    difficulty: 2,
    tags: ['development'],
    question: 'Quel principe d’ouverture est le plus fiable ?',
    answers: [
      'Développer les pièces, contrôler le centre, mettre le roi en sécurité',
      'Sortir la dame dès le premier coup coûte que coûte',
      'Ne jamais avancer de pion',
      'Roquer uniquement au 20e coup',
    ],
    correctAnswer: 0,
    explanation:
      'Les principes classiques restent : développement, centre et sécurité du roi avant les aventures prématurées.',
    i18nEn: {
      question: 'Which opening principle is most reliable?',
      answers: [
        'Develop pieces, control the center, and keep the king safe',
        'Bring the queen out on move one at all costs',
        'Never push a pawn',
        'Castle only on move 20',
      ],
      explanation:
        'Classic principles still hold: development, center, and king safety before premature adventures.',
    },
  }),
  q({
    id: 'openings-new-011',
    category: 'openings',
    subcategory: 'nimzo',
    difficulty: 3,
    tags: ['nimzo-indian'],
    question: 'Quelle ouverture commence souvent par 1.d4 Cf6 2.c4 e6 3.Cc3 Fb4 ?',
    answers: [
      'La défense Nimzo-Indienne',
      'La défense hollandaise',
      'La défense Benoni',
      'Le gambit budapestois',
    ],
    correctAnswer: 0,
    explanation:
      'Le coup …Fb4 cloue le cavalier c3 et combat pour le contrôle de e4, idée centrale de la Nimzo-Indienne.',
    i18nEn: {
      question: 'Which opening often begins 1.d4 Nf6 2.c4 e6 3.Nc3 Bb4?',
      answers: [
        'The Nimzo-Indian Defense',
        'The Dutch Defense',
        'The Benoni Defense',
        'The Budapest Gambit',
      ],
      explanation:
        '…Bb4 pins the c3-knight and fights for e4 — the core idea of the Nimzo-Indian.',
    },
  }),
];
