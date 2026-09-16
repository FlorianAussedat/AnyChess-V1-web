/**
 * Photo-recognition + related modern-player questions.
 * Images referenced only via stable registry keys (see playerImages.ts).
 * Original AnyChess wording — bilingual FR + EN.
 */
import type { ChessCultureQuestion } from '../types.ts';
import type { PlayerImageKey } from '../playerImageMeta.ts';
import { defineQuestion as q } from './_helpers.ts';

type PhotoDraft = {
  id: string;
  imageKey: PlayerImageKey;
  correct: string;
  distractors: [string, string, string];
  difficulty?: 1 | 2 | 3 | 4 | 5;
  explanationFr: string;
  explanationEn: string;
  questionFr?: string;
  questionEn?: string;
};

function photoQuestion(draft: PhotoDraft): ChessCultureQuestion {
  const answers = [draft.correct, ...draft.distractors] as [
    string,
    string,
    string,
    string,
  ];
  return q({
    id: draft.id,
    category: 'modern-chess',
    subcategory: 'player-photo',
    difficulty: draft.difficulty ?? 2,
    tags: ['player-photo', draft.imageKey, 'modern'],
    sourceType: 'historical-fact',
    question: draft.questionFr ?? 'Quel joueur est représenté sur cette photo ?',
    answers,
    correctAnswer: 0,
    explanation: draft.explanationFr,
    presentation: {
      imageId: draft.imageKey,
      imageAlt: draft.correct,
      imageFit: 'cover',
    },
    i18nEn: {
      question: draft.questionEn ?? 'Which player is shown in this photo?',
      answers,
      explanation: draft.explanationEn,
    },
  });
}

export const PLAYER_PHOTO_QUESTIONS: ChessCultureQuestion[] = [
  photoQuestion({
    id: 'player-photo-001',
    imageKey: 'gukesh',
    correct: 'Gukesh D',
    distractors: ['Rameshbabu Praggnanandhaa', 'Alireza Firouzja', 'Nodirbek Abdusattorov'],
    explanationFr:
      'Gukesh Dommaraju (Gukesh D) est devenu champion du monde classique en 2024 en battant Ding Liren.',
    explanationEn:
      'Gukesh Dommaraju (Gukesh D) became classical World Champion in 2024 by defeating Ding Liren.',
  }),
  photoQuestion({
    id: 'player-photo-002',
    imageKey: 'praggnanandhaa',
    correct: 'Rameshbabu Praggnanandhaa',
    distractors: ['Gukesh D', 'Viswanathan Anand', 'Nihal Sarin'],
    explanationFr:
      'Praggnanandhaa est un grand maître indien de la génération des années 2020, plusieurs fois présent dans le cycle mondial.',
    explanationEn:
      'Praggnanandhaa is an Indian grandmaster of the 2020s generation, repeatedly involved in the world-championship cycle.',
  }),
  photoQuestion({
    id: 'player-photo-003',
    imageKey: 'nepomniachtchi',
    correct: 'Ian Nepomniachtchi',
    distractors: ['Ding Liren', 'Sergey Karjakin', 'Vladimir Kramnik'],
    explanationFr:
      'Ian Nepomniachtchi a disputé les Championnats du monde classiques 2021 et 2023.',
    explanationEn:
      'Ian Nepomniachtchi contested the classical World Championships of 2021 and 2023.',
  }),
  photoQuestion({
    id: 'player-photo-004',
    imageKey: 'mvl',
    correct: 'Maxime Vachier-Lagrave',
    distractors: ['Alireza Firouzja', 'Étienne Bacrot', 'Fabiano Caruana'],
    explanationFr:
      'Maxime Vachier-Lagrave (MVL) est l’un des meilleurs joueurs français du XXIe siècle.',
    explanationEn:
      'Maxime Vachier-Lagrave (MVL) is one of France’s strongest 21st-century players.',
  }),
  photoQuestion({
    id: 'player-photo-005',
    imageKey: 'alirezaFirouzja',
    correct: 'Alireza Firouzja',
    distractors: ['Parham Maghsoodloo', 'Amin Tabatabaei', 'Hans Niemann'],
    explanationFr:
      'Alireza Firouzja, né en 2003, s’est imposé parmi l’élite mondiale dans les années 2020.',
    explanationEn:
      'Alireza Firouzja, born in 2003, broke into the world elite during the 2020s.',
  }),
  photoQuestion({
    id: 'player-photo-006',
    imageKey: 'hikaruNakamura',
    correct: 'Hikaru Nakamura',
    distractors: ['Fabiano Caruana', 'Wesley So', 'Levon Aronian'],
    explanationFr:
      'Hikaru Nakamura est une figure majeure de l’élite américaine et du streaming d’échecs en ligne.',
    explanationEn:
      'Hikaru Nakamura is a major figure of the American elite and of online chess streaming.',
  }),
  photoQuestion({
    id: 'player-photo-007',
    imageKey: 'hansNiemann',
    correct: 'Hans Niemann',
    distractors: ['Hikaru Nakamura', 'Fabiano Caruana', 'Leinier Domínguez'],
    explanationFr:
      'Hans Niemann est un grand maître américain très médiatisé dans les années 2020.',
    explanationEn:
      'Hans Niemann is an American grandmaster who became widely discussed in the 2020s.',
  }),
  photoQuestion({
    id: 'player-photo-008',
    imageKey: 'wesleySo',
    correct: 'Wesley So',
    distractors: ['Hikaru Nakamura', 'Levon Aronian', 'Sam Shankland'],
    explanationFr:
      'Wesley So, né aux Philippines et représentant les USA, est un régulier du top mondial moderne.',
    explanationEn:
      'Wesley So, born in the Philippines and representing the USA, is a regular of the modern world elite.',
  }),
  photoQuestion({
    id: 'player-photo-009',
    imageKey: 'anand',
    correct: 'Viswanathan Anand',
    distractors: ['Magnus Carlsen', 'Gukesh D', 'Vladimir Kramnik'],
    explanationFr:
      'Viswanathan Anand, multiple champion du monde, a notamment perdu le titre face à Carlsen en 2013.',
    explanationEn:
      'Viswanathan Anand, a multiple World Champion, notably lost the title to Carlsen in 2013.',
  }),
  photoQuestion({
    id: 'player-photo-010',
    imageKey: 'magnusCarlsen',
    correct: 'Magnus Carlsen',
    distractors: ['Hikaru Nakamura', 'Fabiano Caruana', 'Ian Nepomniachtchi'],
    explanationFr:
      'Magnus Carlsen a été champion du monde classique de 2013 à 2023 (non-défense du titre en 2023).',
    explanationEn:
      'Magnus Carlsen was classical World Champion from 2013 to 2023 (he declined to defend in 2023).',
  }),
  photoQuestion({
    id: 'player-photo-011',
    imageKey: 'dingLiren',
    correct: 'Ding Liren',
    distractors: ['Ian Nepomniachtchi', 'Wei Yi', 'Gukesh D'],
    explanationFr:
      'Ding Liren a remporté le titre mondial classique en 2023 avant de le céder à Gukesh en 2024.',
    explanationEn:
      'Ding Liren won the classical world title in 2023 before losing it to Gukesh in 2024.',
  }),

  // Non-photo modern-player culture (mix requirement)
  q({
    id: 'player-clue-001',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['niemann', 'modern'],
    sourceType: 'historical-fact',
    question:
      'Quel grand maître américain a fortement marqué l’actualité échiquéenne après la Sinquefield Cup 2022 ?',
    answers: [
      'Hans Niemann',
      'Paul Morphy',
      'Samuel Reshevsky',
      'Reuben Fine',
    ],
    correctAnswer: 0,
    explanation:
      'Hans Niemann est devenu très visible médiatiquement après les événements autour de la Sinquefield Cup 2022.',
    i18nEn: {
      question:
        'Which American grandmaster heavily shaped chess headlines after the 2022 Sinquefield Cup?',
      answers: [
        'Hans Niemann',
        'Paul Morphy',
        'Samuel Reshevsky',
        'Reuben Fine',
      ],
      explanation:
        'Hans Niemann became highly visible in the media after events around the 2022 Sinquefield Cup.',
    },
  }),
  q({
    id: 'player-clue-002',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['carlsen', 'nepo', 'rivalry'],
    sourceType: 'historical-fact',
    question:
      'Qui a affronté Magnus Carlsen dans le Championnat du monde classique 2021 à Dubaï ?',
    answers: [
      'Ian Nepomniachtchi',
      'Ding Liren',
      'Fabiano Caruana',
      'Sergey Karjakin',
    ],
    correctAnswer: 0,
    explanation:
      'Nepomniachtchi a remporté les Candidats 2020–21 et a perdu le match de Dubaï face à Carlsen.',
    i18nEn: {
      question:
        'Whom did Magnus Carlsen face in the 2021 classical World Championship in Dubai?',
      answers: [
        'Ian Nepomniachtchi',
        'Ding Liren',
        'Fabiano Caruana',
        'Sergey Karjakin',
      ],
      explanation:
        'Nepomniachtchi won the 2020–21 Candidates and lost the Dubai match to Carlsen.',
    },
  }),
  q({
    id: 'player-clue-003',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['nakamura', 'speed'],
    sourceType: 'historical-fact',
    question:
      'Quel joueur américain est particulièrement associé aux succès en blitz/rapide et au boom du streaming ?',
    answers: [
      'Hikaru Nakamura',
      'Bobby Fischer',
      'Frank Marshall',
      'Harry Nelson Pillsbury',
    ],
    correctAnswer: 0,
    explanation:
      'Nakamura cumule une carrière élite OTB et une présence dominante sur les plateformes de streaming.',
    i18nEn: {
      question:
        'Which American player is especially associated with blitz/rapid success and the streaming boom?',
      answers: [
        'Hikaru Nakamura',
        'Bobby Fischer',
        'Frank Marshall',
        'Harry Nelson Pillsbury',
      ],
      explanation:
        'Nakamura combines an elite over-the-board career with a dominant streaming presence.',
    },
  }),
];
