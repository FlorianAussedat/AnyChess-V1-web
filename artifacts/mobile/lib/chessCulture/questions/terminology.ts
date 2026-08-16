/**
 * Practical chess terminology / concept questions.
 * Original AnyChess wording — bilingual FR + EN.
 */
import type { ChessCultureQuestion } from '../types.ts';
import { defineQuestion as q } from './_helpers.ts';

export const TERMINOLOGY_QUESTIONS: ChessCultureQuestion[] = [
  q({
    id: 'terminology-new-001',
    category: 'terminology',
    subcategory: 'tactics',
    difficulty: 2,
    tags: ['pin', 'tactics'],
    question: 'Qu’est-ce qu’un clouage (pin) ?',
    answers: [
      'Une pièce immobilisée car bouger exposerait une pièce de plus grande valeur',
      'Un échec double simultané',
      'Un pion passé sur la 7e rangée',
      'Un échange forcé de dames',
    ],
    correctAnswer: 0,
    explanation:
      'Dans un clouage, une pièce ne peut (ou ne devrait) pas bouger sans découvrir une pièce plus importante derrière elle.',
    i18nEn: {
      question: 'What is a pin?',
      answers: [
        'A piece that cannot safely move because doing so would expose a more valuable piece',
        'A simultaneous double check',
        'A passed pawn on the 7th rank',
        'A forced queen trade',
      ],
      explanation:
        'In a pin, a piece cannot (or should not) move without uncovering a more important piece behind it.',
    },
  }),
  q({
    id: 'terminology-new-002',
    category: 'terminology',
    subcategory: 'tactics',
    difficulty: 2,
    tags: ['skewer', 'tactics'],
    question: 'En quoi une enfilade (skewer) diffère-t-elle d’un clouage ?',
    answers: [
      'La pièce de plus grande valeur est devant et doit souvent s’écarter',
      'Seuls les pions peuvent enfiler',
      'C’est toujours un échec au roi',
      'Elle n’existe qu’en finale',
    ],
    correctAnswer: 0,
    explanation:
      'Dans l’enfilade, la pièce la plus précieuse est attaquée en premier ; en s’écartant, elle laisse la pièce derrière exposée.',
    i18nEn: {
      question: 'How does a skewer differ from a pin?',
      answers: [
        'The more valuable piece stands in front and often must move away',
        'Only pawns can deliver skewers',
        'It is always a check to the king',
        'It only exists in endgames',
      ],
      explanation:
        'In a skewer, the more valuable piece is attacked first; when it moves, the piece behind it is left exposed.',
    },
  }),
  q({
    id: 'terminology-new-003',
    category: 'terminology',
    subcategory: 'tactics',
    difficulty: 3,
    tags: ['zwischenzug', 'tactics'],
    question: 'Qu’est-ce qu’un zwischenzug ?',
    answers: [
      'Un coup intermédiaire joué avant la réponse attendue',
      'Un roque artificiel',
      'Une promotion en cavalier',
      'Un sacrifice de qualité forcé',
    ],
    correctAnswer: 0,
    explanation:
      'Un zwischenzug est un coup intermédiaire joué avant la réponse attendue, qui change souvent la situation tactique.',
    i18nEn: {
      question: 'What is a zwischenzug?',
      answers: [
        'An intermediate move played before the expected reply',
        'An artificial castling maneuver',
        'Underpromotion to a knight',
        'A forced exchange sacrifice',
      ],
      explanation:
        'A zwischenzug is an intermediate move played before the expected reply, often changing the tactical situation.',
    },
  }),
  q({
    id: 'terminology-new-004',
    category: 'terminology',
    subcategory: 'strategy',
    difficulty: 3,
    tags: ['zugzwang', 'endgame'],
    question: 'Que signifie être en zugzwang ?',
    answers: [
      'Toute légalité de coup empire la position',
      'On a trop de temps sur l’horloge',
      'On doit obligatoirement capturer',
      'On a perdu le droit de roquer',
    ],
    correctAnswer: 0,
    explanation:
      'En zugzwang, l’obligation de jouer nuit : chaque coup légal affaiblit la position.',
    i18nEn: {
      question: 'What does it mean to be in zugzwang?',
      answers: [
        'Any legal move makes the position worse',
        'You have too much time on the clock',
        'You are forced to capture',
        'You have lost castling rights',
      ],
      explanation:
        'In zugzwang, the duty to move hurts: every legal move weakens the position.',
    },
  }),
  q({
    id: 'terminology-new-005',
    category: 'terminology',
    subcategory: 'pawns',
    difficulty: 2,
    tags: ['passed-pawn'],
    question: 'Qu’est-ce qu’un pion passé ?',
    answers: [
      'Un pion sans pion adverse sur sa colonne ni les colonnes adjacentes devant lui',
      'Un pion qui a déjà capturé',
      'Un pion resté sur sa case de départ',
      'Un pion protégé uniquement par le roi',
    ],
    correctAnswer: 0,
    explanation:
      'Un pion passé n’a plus de pion adverse capable de le bloquer ou de le capturer sur sa route vers la promotion.',
    i18nEn: {
      question: 'What is a passed pawn?',
      answers: [
        'A pawn with no enemy pawns on its file or adjacent files ahead of it',
        'A pawn that has already captured',
        'A pawn still on its starting square',
        'A pawn protected only by the king',
      ],
      explanation:
        'A passed pawn has no enemy pawn that can block or capture it on its path to promotion.',
    },
  }),
  q({
    id: 'terminology-new-006',
    category: 'terminology',
    subcategory: 'pawns',
    difficulty: 3,
    tags: ['isolated-pawn'],
    question: 'Qu’est-ce qu’un pion isolé ?',
    answers: [
      'Un pion sans pion ami sur les colonnes voisines',
      'Un pion doublé sur la même colonne',
      'Un pion passé sur la 7e',
      'Un pion qui ne peut plus avancer',
    ],
    correctAnswer: 0,
    explanation:
      'Sans pions amis voisins, le pion isolé ne peut pas être défendu par un autre pion et crée souvent une case faible devant lui.',
    i18nEn: {
      question: 'What is an isolated pawn?',
      answers: [
        'A pawn with no friendly pawn on neighboring files',
        'A doubled pawn on the same file',
        'A passed pawn on the 7th',
        'A pawn that can no longer advance',
      ],
      explanation:
        'Without neighboring friendly pawns, an isolated pawn cannot be defended by another pawn and often creates a weak square in front of it.',
    },
  }),
  q({
    id: 'terminology-new-007',
    category: 'terminology',
    subcategory: 'pawns',
    difficulty: 3,
    tags: ['backward-pawn'],
    question: 'Qu’est-ce qu’un pion arriéré ?',
    answers: [
      'Un pion en retard sur ses voisins, souvent bloqué et difficile à défendre',
      'Un pion déjà promu',
      'Un pion qui vient de prendre en passant',
      'Un pion du camp adverse capturé',
    ],
    correctAnswer: 0,
    explanation:
      'Le pion arriéré est en retard sur la chaîne ; il peut devenir une cible car les pions voisins ne le soutiennent plus efficacement.',
    i18nEn: {
      question: 'What is a backward pawn?',
      answers: [
        'A pawn lagging behind its neighbors, often blocked and hard to defend',
        'A pawn that has already promoted',
        'A pawn that just captured en passant',
        'An enemy pawn that was captured',
      ],
      explanation:
        'A backward pawn lags behind its chain; it can become a target because neighboring pawns no longer support it effectively.',
    },
  }),
  q({
    id: 'terminology-new-008',
    category: 'terminology',
    subcategory: 'strategy',
    difficulty: 3,
    tags: ['outpost'],
    question: 'Qu’est-ce qu’un avant-poste (outpost) ?',
    answers: [
      'Une case avancée, souvent soutenue par un pion, où une pièce adverse ne peut plus être chassée par un pion',
      'La case de départ du roi',
      'Une case uniquement utile en blitz',
      'La case de promotion a8',
    ],
    correctAnswer: 0,
    explanation:
      'Un avant-poste est une case forte (souvent pour un cavalier) que les pions adverses ne peuvent plus chasser.',
    i18nEn: {
      question: 'What is an outpost?',
      answers: [
        'An advanced square, often pawn-supported, where a piece cannot be chased away by an enemy pawn',
        'The king’s starting square',
        'A square useful only in blitz',
        'The a8 promotion square',
      ],
      explanation:
        'An outpost is a strong square (often for a knight) that enemy pawns can no longer drive away.',
    },
  }),
  q({
    id: 'terminology-new-009',
    category: 'terminology',
    subcategory: 'files',
    difficulty: 2,
    tags: ['open-file'],
    question: 'Qu’est-ce qu’une colonne ouverte ?',
    answers: [
      'Une colonne sans pion d’aucun camp',
      'Une colonne contrôlée uniquement par les fous',
      'Une colonne où les deux rois ont roqué',
      'Une colonne réservée aux cavaliers',
    ],
    correctAnswer: 0,
    explanation:
      'Sans pions sur la colonne, les tours et la dame peuvent l’utiliser pleinement pour pénétrer.',
    i18nEn: {
      question: 'What is an open file?',
      answers: [
        'A file with no pawns of either side',
        'A file controlled only by bishops',
        'A file where both kings have castled',
        'A file reserved for knights',
      ],
      explanation:
        'With no pawns on the file, rooks and the queen can use it fully to penetrate.',
    },
  }),
  q({
    id: 'terminology-new-010',
    category: 'terminology',
    subcategory: 'files',
    difficulty: 2,
    tags: ['semi-open-file'],
    question: 'Qu’est-ce qu’une colonne semi-ouverte ?',
    answers: [
      'Une colonne où un seul camp a encore un pion',
      'Une colonne totalement vide',
      'Une colonne avec quatre pions',
      'Une diagonale ouverte',
    ],
    correctAnswer: 0,
    explanation:
      'Sur une colonne semi-ouverte, un camp (souvent celui sans pion) peut presser avec des tours contre le pion restant.',
    i18nEn: {
      question: 'What is a semi-open file?',
      answers: [
        'A file where only one side still has a pawn',
        'A completely empty file',
        'A file with four pawns',
        'An open diagonal',
      ],
      explanation:
        'On a semi-open file, the side without a pawn can often pressure the remaining enemy pawn with rooks.',
    },
  }),
  q({
    id: 'terminology-new-011',
    category: 'terminology',
    subcategory: 'development',
    difficulty: 2,
    tags: ['fianchetto'],
    question: 'Que signifie « fianchetto » ?',
    answers: [
      'Développer un fou sur la longue diagonale via g3/b3 (ou g6/b6)',
      'Sacrifier un pion dès le premier coup',
      'Roquer du côté dame uniquement',
      'Échanger les deux tours',
    ],
    correctAnswer: 0,
    explanation:
      'Le fianchetto place le fou en g2/b2 (ou g7/b7) pour contrôler une longue diagonale.',
    i18nEn: {
      question: 'What does “fianchetto” mean?',
      answers: [
        'Developing a bishop onto the long diagonal via g3/b3 (or g6/b6)',
        'Sacrificing a pawn on move one',
        'Castling queenside only',
        'Trading both rooks',
      ],
      explanation:
        'A fianchetto places the bishop on g2/b2 (or g7/b7) to control a long diagonal.',
    },
  }),
  q({
    id: 'terminology-new-012',
    category: 'terminology',
    subcategory: 'openings',
    difficulty: 2,
    tags: ['gambit'],
    question: 'Qu’est-ce qu’un gambit ?',
    answers: [
      'Un sacrifice de matériel (souvent un pion) pour un avantage dynamique',
      'Une nulle par répétition',
      'Une règle de blitz spéciale',
      'Un mat forcé en deux coups',
    ],
    correctAnswer: 0,
    explanation:
      'Un gambit offre du matériel pour gagner du temps, du développement ou une initiative d’attaque.',
    i18nEn: {
      question: 'What is a gambit?',
      answers: [
        'A material sacrifice (often a pawn) for dynamic compensation',
        'A draw by repetition',
        'A special blitz rule',
        'A forced mate in two',
      ],
      explanation:
        'A gambit offers material to gain time, development, or attacking initiative.',
    },
  }),
  q({
    id: 'terminology-new-013',
    category: 'terminology',
    subcategory: 'endgame',
    difficulty: 3,
    tags: ['fortress'],
    question: 'Qu’est-ce qu’une forteresse aux échecs ?',
    answers: [
      'Une structure où le camp inférieur peut tenir la nulle malgré un déficit matériel',
      'Un château construit avec les tours',
      'Un mat forcé en trois coups',
      'Une ouverture fermée seulement',
    ],
    correctAnswer: 0,
    explanation:
      'Une forteresse est une configuration défensive où l’adversaire ne peut pas progresser malgré l’avantage matériel.',
    i18nEn: {
      question: 'What is a fortress in chess?',
      answers: [
        'A setup where the weaker side can hold a draw despite a material deficit',
        'A castle built with the rooks',
        'A forced mate in three',
        'Only a closed opening',
      ],
      explanation:
        'A fortress is a defensive configuration where the opponent cannot make progress despite a material advantage.',
    },
  }),
  q({
    id: 'terminology-new-014',
    category: 'terminology',
    subcategory: 'tactics',
    difficulty: 2,
    tags: ['discovered-attack'],
    question: 'Qu’est-ce qu’une attaque à découverte ?',
    answers: [
      'Une pièce bouge et révèle l’attaque d’une autre pièce derrière elle',
      'Deux pions avancent en même temps',
      'Le roi change de couleur',
      'Un coup illégal corrigé',
    ],
    correctAnswer: 0,
    explanation:
      'En déplaçant une pièce, on découvre la ligne d’action d’une pièce située derrière (fou, tour, dame).',
    i18nEn: {
      question: 'What is a discovered attack?',
      answers: [
        'A piece moves and reveals an attack from another piece behind it',
        'Two pawns advance at once',
        'The king changes color',
        'An illegal move being corrected',
      ],
      explanation:
        'By moving one piece, you uncover the line of a piece behind it (bishop, rook, or queen).',
    },
  }),
  q({
    id: 'terminology-new-015',
    category: 'terminology',
    subcategory: 'tactics',
    difficulty: 2,
    tags: ['discovered-check'],
    question: 'Qu’est-ce qu’un échec à découverte ?',
    answers: [
      'Une attaque à découverte qui met le roi adverse en échec',
      'Un échec donné uniquement par un pion',
      'Un échec après promotion',
      'Un échec annoncé à voix haute',
    ],
    correctAnswer: 0,
    explanation:
      'C’est une attaque à découverte où la pièce découverte attaque directement le roi.',
    i18nEn: {
      question: 'What is a discovered check?',
      answers: [
        'A discovered attack that puts the enemy king in check',
        'A check given only by a pawn',
        'A check after promotion',
        'A check announced out loud',
      ],
      explanation:
        'It is a discovered attack in which the uncovered piece checks the king directly.',
    },
  }),
  q({
    id: 'terminology-new-016',
    category: 'terminology',
    subcategory: 'tactics',
    difficulty: 2,
    tags: ['double-attack', 'fork'],
    question: 'Qu’est-ce qu’une double attaque ?',
    answers: [
      'Une pièce attaque au moins deux cibles importantes en même temps',
      'Deux joueurs jouent le même coup',
      'Un coup qui capture deux pièces d’un seul geste',
      'Un échec perpétuel uniquement',
    ],
    correctAnswer: 0,
    explanation:
      'La fourchette du cavalier en est l’exemple classique : une pièce menace plusieurs objectifs à la fois.',
    i18nEn: {
      question: 'What is a double attack?',
      answers: [
        'One piece attacks at least two important targets at once',
        'Two players make the same move',
        'A move that captures two pieces in one gesture',
        'Perpetual check only',
      ],
      explanation:
        'A knight fork is the classic example: one piece threatens several targets at once.',
    },
  }),
  q({
    id: 'terminology-new-017',
    category: 'terminology',
    subcategory: 'endgame',
    difficulty: 3,
    tags: ['opposition'],
    question: 'Qu’est-ce que l’opposition (des rois) ?',
    answers: [
      'Les rois se font face avec une case entre eux ; celui qui ne doit pas bouger a souvent l’avantage',
      'Deux fous de même couleur',
      'Un échange de tours forcé',
      'Un clouage sur la colonne e',
    ],
    correctAnswer: 0,
    explanation:
      'L’opposition est un thème de finale de pions : le camp qui « a » l’opposition peut souvent forcer le passage.',
    i18nEn: {
      question: 'What is (king) opposition?',
      answers: [
        'Kings face each other with one square between them; the side not to move often benefits',
        'Two bishops of the same color',
        'A forced rook trade',
        'A pin on the e-file',
      ],
      explanation:
        'Opposition is a pawn-ending theme: the side that “has” the opposition can often force a breakthrough.',
    },
  }),
  q({
    id: 'terminology-new-018',
    category: 'terminology',
    subcategory: 'strategy',
    difficulty: 3,
    tags: ['initiative'],
    question: 'Que signifie avoir l’initiative ?',
    answers: [
      'Poser des menaces qui obligent l’adversaire à répondre',
      'Avoir plus de matériel seulement',
      'Avoir moins de temps à l’horloge',
      'Avoir déjà roqué',
    ],
    correctAnswer: 0,
    explanation:
      'L’initiative, c’est dicter le rythme : l’adversaire est contraint de parer plutôt que de créer ses propres plans.',
    i18nEn: {
      question: 'What does it mean to have the initiative?',
      answers: [
        'Creating threats that force the opponent to respond',
        'Having more material only',
        'Having less time on the clock',
        'Having already castled',
      ],
      explanation:
        'Initiative means dictating the tempo: the opponent must parry instead of creating their own plans.',
    },
  }),
  q({
    id: 'terminology-new-019',
    category: 'terminology',
    subcategory: 'strategy',
    difficulty: 3,
    tags: ['tempo'],
    question: 'Que signifie gagner un tempo ?',
    answers: [
      'Obtenir un coup « gratuit » d’avance dans le développement ou le plan',
      'Gagner une pièce majeure',
      'Forcer une nulle immédiate',
      'Passer son tour volontairement',
    ],
    correctAnswer: 0,
    explanation:
      'Un tempo est une unité de temps (un coup). En gagner un, c’est avancer son plan plus vite que l’adversaire.',
    i18nEn: {
      question: 'What does it mean to gain a tempo?',
      answers: [
        'Getting a “free” move ahead in development or in a plan',
        'Winning a major piece',
        'Forcing an immediate draw',
        'Passing your turn voluntarily',
      ],
      explanation:
        'A tempo is a unit of time (one move). Gaining one means advancing your plan faster than the opponent.',
    },
  }),
  q({
    id: 'terminology-new-020',
    category: 'terminology',
    subcategory: 'tactics',
    difficulty: 3,
    tags: ['exchange-sacrifice'],
    question: 'Qu’est-ce qu’un sacrifice de qualité ?',
    answers: [
      'Donner une tour contre un fou ou un cavalier pour une compensation',
      'Échanger les dames dès l’ouverture',
      'Sacrifier le roi',
      'Promouvoir en tour plutôt qu’en dame',
    ],
    correctAnswer: 0,
    explanation:
      'On cède la tour contre une pièce mineure pour des cases, une attaque, ou une structure de pions favorable.',
    i18nEn: {
      question: 'What is an exchange sacrifice?',
      answers: [
        'Giving a rook for a bishop or knight for compensation',
        'Trading queens in the opening',
        'Sacrificing the king',
        'Promoting to a rook instead of a queen',
      ],
      explanation:
        'You give up a rook for a minor piece to gain squares, an attack, or a favorable pawn structure.',
    },
  }),
  q({
    id: 'terminology-new-021',
    category: 'terminology',
    subcategory: 'strategy',
    difficulty: 3,
    tags: ['rook-lift'],
    question: 'Qu’est-ce qu’un lift de tour (rook lift) ?',
    answers: [
      'Amener une tour via une rangée (souvent la 3e) vers l’aile pour attaquer',
      'Élever le plateau de jeu',
      'Promouvoir un pion en tour',
      'Échanger les deux tours',
    ],
    correctAnswer: 0,
    explanation:
      'Le rook lift réoriente une tour (ex. Th3–g3) pour renforcer une attaque sans passer par une colonne ouverte classique.',
    i18nEn: {
      question: 'What is a rook lift?',
      answers: [
        'Bringing a rook via a rank (often the 3rd) toward a wing to attack',
        'Raising the chessboard',
        'Promoting a pawn to a rook',
        'Trading both rooks',
      ],
      explanation:
        'A rook lift repositions a rook (e.g. Rh3–g3) to join an attack without using a classic open file.',
    },
  }),
  q({
    id: 'terminology-new-022',
    category: 'terminology',
    subcategory: 'strategy',
    difficulty: 4,
    tags: ['minority-attack'],
    question: 'Qu’est-ce qu’une attaque de minorité ?',
    answers: [
      'Avancer une minorité de pions pour créer une faiblesse dans une majorité adverse',
      'Attaquer seulement avec les pièces mineures',
      'Jouer sans les dames',
      'Sacrifier deux pièces pour un pion',
    ],
    correctAnswer: 0,
    explanation:
      'Classique du Gambit Dame : les Blancs poussent a/b pour endommager la structure de pions noirs (souvent c6).',
    i18nEn: {
      question: 'What is a minority attack?',
      answers: [
        'Advancing a pawn minority to create a weakness in an enemy pawn majority',
        'Attacking only with minor pieces',
        'Playing without queens',
        'Sacrificing two pieces for a pawn',
      ],
      explanation:
        'Classic in the Queen’s Gambit: White pushes a/b to damage Black’s pawn structure (often around c6).',
    },
  }),
  q({
    id: 'terminology-new-023',
    category: 'terminology',
    subcategory: 'pawns',
    difficulty: 3,
    tags: ['hanging-pawns'],
    question: 'Que sont des pions pendants (hanging pawns) ?',
    answers: [
      'Deux pions voisins sur des colonnes semi-ouvertes, sans pion ami adjacent',
      'Des pions déjà capturés',
      'Des pions passés liés',
      'Des pions cloués sur la 2e rangée',
    ],
    correctAnswer: 0,
    explanation:
      'Les pions pendants (souvent c4–d4) offrent de l’espace mais peuvent devenir des cibles s’ils sont bloqués.',
    i18nEn: {
      question: 'What are hanging pawns?',
      answers: [
        'Two neighboring pawns on semi-open files without adjacent friendly pawns',
        'Pawns that have already been captured',
        'Connected passed pawns',
        'Pawns pinned on the 2nd rank',
      ],
      explanation:
        'Hanging pawns (often c4–d4) grant space but can become targets if they are restrained.',
    },
  }),
  q({
    id: 'terminology-new-024',
    category: 'terminology',
    subcategory: 'tactics',
    difficulty: 2,
    tags: ['battery'],
    question: 'Qu’est-ce qu’une batterie ?',
    answers: [
      'Aligner deux pièces lourdes/légères sur une même ligne pour renforcer une attaque',
      'Un chargeur pour pendule électronique',
      'Deux rois face à face',
      'Un pion doublé forcé',
    ],
    correctAnswer: 0,
    explanation:
      'Exemple : dame + fou sur une diagonale, ou dame + tour sur une colonne, pour concentrer la pression.',
    i18nEn: {
      question: 'What is a battery?',
      answers: [
        'Aligning two heavy/minor pieces on the same line to strengthen an attack',
        'A charger for an electronic clock',
        'Two kings facing each other',
        'A forced doubled pawn',
      ],
      explanation:
        'Example: queen + bishop on a diagonal, or queen + rook on a file, to concentrate pressure.',
    },
  }),
];
