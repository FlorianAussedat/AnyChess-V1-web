/**
 * Modern chess (≈2010+) players, events, and culture questions.
 * Prefer dated/historical facts. Verified against FIDE/major reports.
 * Original AnyChess wording — bilingual FR + EN.
 */
import type { ChessCultureQuestion } from '../types.ts';
import { defineQuestion as q } from './_helpers.ts';

export const MODERN_CHESS_QUESTIONS: ChessCultureQuestion[] = [
  q({
    id: 'modern-001',
    category: 'modern-chess',
    subcategory: 'world-championship',
    difficulty: 2,
    tags: ['caruana', 'carlsen', '2018'],
    sourceType: 'historical-fact',
    question: 'Qui a défié Magnus Carlsen pour le titre mondial classique en 2018 à Londres ?',
    answers: [
      'Fabiano Caruana',
      'Sergey Karjakin',
      'Ian Nepomniachtchi',
      'Ding Liren',
    ],
    correctAnswer: 0,
    explanation:
      'Caruana a remporté les Candidats 2018 et a affronté Carlsen à Londres ; le match classique s’est terminé 6–6 avant des départages rapides.',
    i18nEn: {
      question: 'Who challenged Magnus Carlsen for the classical World Championship in 2018 in London?',
      answers: [
        'Fabiano Caruana',
        'Sergey Karjakin',
        'Ian Nepomniachtchi',
        'Ding Liren',
      ],
      explanation:
        'Caruana won the 2018 Candidates and faced Carlsen in London; the classical match ended 6–6 before rapid tiebreaks.',
    },
  }),
  q({
    id: 'modern-002',
    category: 'modern-chess',
    subcategory: 'world-championship',
    difficulty: 2,
    tags: ['ding', 'nepo', '2023'],
    sourceType: 'historical-fact',
    question:
      'Qui a remporté le Championnat du monde classique 2023 face à Ian Nepomniachtchi ?',
    answers: ['Ding Liren', 'Magnus Carlsen', 'Fabiano Caruana', 'Gukesh Dommaraju'],
    correctAnswer: 0,
    explanation:
      'Après le forfait de Carlsen, Ding a battu Nepomniachtchi à Astana (départages rapides) et est devenu le 17e champion du monde.',
    i18nEn: {
      question: 'Who won the 2023 classical World Championship match against Ian Nepomniachtchi?',
      answers: ['Ding Liren', 'Magnus Carlsen', 'Fabiano Caruana', 'Gukesh Dommaraju'],
      explanation:
        'After Carlsen declined to defend, Ding beat Nepomniachtchi in Astana (rapid tiebreaks) to become the 17th World Champion.',
    },
  }),
  q({
    id: 'modern-003',
    category: 'modern-chess',
    subcategory: 'world-championship',
    difficulty: 2,
    tags: ['gukesh', 'ding', '2024'],
    sourceType: 'historical-fact',
    question:
      'Qui a battu Ding Liren en 2024 pour devenir champion du monde classique ?',
    answers: [
      'Gukesh Dommaraju',
      'Praggnanandhaa',
      'Hikaru Nakamura',
      'Alireza Firouzja',
    ],
    correctAnswer: 0,
    explanation:
      'Gukesh a remporté le match de Singapour 2024 (7,5–6,5) et est devenu le plus jeune champion du monde classique incontesté.',
    i18nEn: {
      question: 'Who defeated Ding Liren in 2024 to become classical World Champion?',
      answers: [
        'Gukesh Dommaraju',
        'Praggnanandhaa',
        'Hikaru Nakamura',
        'Alireza Firouzja',
      ],
      explanation:
        'Gukesh won the 2024 Singapore match (7.5–6.5) and became the youngest undisputed classical World Champion.',
    },
  }),
  q({
    id: 'modern-004',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 1,
    tags: ['mvl'],
    sourceType: 'historical-fact',
    question: 'Quel grand maître français est largement connu sous les initiales MVL ?',
    answers: [
      'Maxime Vachier-Lagrave',
      'Étienne Bacrot',
      'Laurent Fressinet',
      'Jules Moussard',
    ],
    correctAnswer: 0,
    explanation:
      'Maxime Vachier-Lagrave, surnommé MVL, est l’un des meilleurs joueurs français du XXIe siècle.',
    i18nEn: {
      question: 'Which French grandmaster is widely known by the initials MVL?',
      answers: [
        'Maxime Vachier-Lagrave',
        'Étienne Bacrot',
        'Laurent Fressinet',
        'Jules Moussard',
      ],
      explanation:
        'Maxime Vachier-Lagrave, nicknamed MVL, is one of France’s strongest 21st-century players.',
    },
  }),
  q({
    id: 'modern-005',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['nakamura', 'online'],
    sourceType: 'historical-fact',
    question:
      'Quel grand maître américain est aussi une figure majeure du streaming d’échecs en ligne depuis les années 2010 ?',
    answers: [
      'Hikaru Nakamura',
      'Bobby Fischer',
      'Samuel Reshevsky',
      'Reuben Fine',
    ],
    correctAnswer: 0,
    explanation:
      'Nakamura combine une carrière élite OTB avec une présence très visible sur Twitch/YouTube pendant le boom en ligne.',
    i18nEn: {
      question:
        'Which American grandmaster has also been a major online chess streaming figure since the 2010s?',
      answers: [
        'Hikaru Nakamura',
        'Bobby Fischer',
        'Samuel Reshevsky',
        'Reuben Fine',
      ],
      explanation:
        'Nakamura combines an elite OTB career with a highly visible Twitch/YouTube presence during the online boom.',
    },
  }),
  q({
    id: 'modern-006',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['carlsen', '2013'],
    sourceType: 'historical-fact',
    question: 'Contre qui Magnus Carlsen a-t-il remporté le titre mondial classique en 2013 ?',
    answers: [
      'Viswanathan Anand',
      'Vladimir Kramnik',
      'Veselin Topalov',
      'Boris Gelfand',
    ],
    correctAnswer: 0,
    explanation:
      'Carlsen a battu Anand à Chennai en 2013 et est devenu champion du monde classique.',
    i18nEn: {
      question: 'Whom did Magnus Carlsen defeat to win the classical World Championship in 2013?',
      answers: [
        'Viswanathan Anand',
        'Vladimir Kramnik',
        'Veselin Topalov',
        'Boris Gelfand',
      ],
      explanation:
        'Carlsen defeated Anand in Chennai in 2013 to become classical World Champion.',
    },
  }),
  q({
    id: 'modern-007',
    category: 'modern-chess',
    subcategory: 'tournaments',
    difficulty: 2,
    tags: ['candidates'],
    sourceType: 'stable-fact',
    question: 'À quoi sert le Tournoi des candidats (Candidates) ?',
    answers: [
      'Désigner le challenger pour le Championnat du monde classique',
      'Remplacer le Championnat du monde de blitz',
      'Classer uniquement les juniors',
      'Attribuer le titre de champion olympique',
    ],
    correctAnswer: 0,
    explanation:
      'Le Candidates sélectionne le challenger qui affrontera le champion du monde (ou dispute le titre si le champion se retire).',
    i18nEn: {
      question: 'What is the purpose of the Candidates Tournament?',
      answers: [
        'To determine the challenger for the classical World Championship',
        'To replace the World Blitz Championship',
        'To rank juniors only',
        'To award the Olympic chess title',
      ],
      explanation:
        'The Candidates selects the challenger who faces the World Champion (or contests the title if the champion withdraws).',
    },
  }),
  q({
    id: 'modern-008',
    category: 'modern-chess',
    subcategory: 'time-controls',
    difficulty: 1,
    tags: ['bullet', 'blitz', 'rapid'],
    sourceType: 'stable-fact',
    question: 'Dans quel ordre va du plus rapide au plus lent ?',
    answers: [
      'Bullet → blitz → rapide → classique',
      'Classique → rapide → blitz → bullet',
      'Blitz → classique → bullet → rapide',
      'Rapide → bullet → classique → blitz',
    ],
    correctAnswer: 0,
    explanation:
      'Le bullet est ultra-court, puis le blitz, le rapide, et enfin le classique (parties longues).',
    i18nEn: {
      question: 'Which order goes from fastest to slowest?',
      answers: [
        'Bullet → blitz → rapid → classical',
        'Classical → rapid → blitz → bullet',
        'Blitz → classical → bullet → rapid',
        'Rapid → bullet → classical → blitz',
      ],
      explanation:
        'Bullet is ultra-short, then blitz, then rapid, then classical (long games).',
    },
  }),
  q({
    id: 'modern-009',
    category: 'modern-chess',
    subcategory: 'tournaments',
    difficulty: 2,
    tags: ['olympiad'],
    sourceType: 'stable-fact',
    question: 'Qu’est-ce que l’Olympiade d’échecs ?',
    answers: [
      'Une compétition par équipes nationales organisée par la FIDE',
      'Un match en deux parties pour le titre mondial',
      'Un open réservé aux moins de 10 ans',
      'Un tournoi uniquement en ligne',
    ],
    correctAnswer: 0,
    explanation:
      'L’Olympiade réunit des équipes nationales (open et féminine) sur plusieurs rondes, en principe tous les deux ans.',
    i18nEn: {
      question: 'What is the Chess Olympiad?',
      answers: [
        'A national-team competition organized by FIDE',
        'A two-game match for the world title',
        'An open reserved for under-10s',
        'An online-only tournament',
      ],
      explanation:
        'The Olympiad brings national teams (open and women’s) together over many rounds, normally every two years.',
    },
  }),
  q({
    id: 'modern-010',
    category: 'modern-chess',
    subcategory: 'tournaments',
    difficulty: 2,
    tags: ['tata-steel'],
    sourceType: 'stable-fact',
    question: 'Où se joue traditionnellement le tournoi Tata Steel Chess ?',
    answers: ['Wijk aan Zee (Pays-Bas)', 'Reykjavik', 'Las Vegas', 'Doha'],
    correctAnswer: 0,
    explanation:
      'Tata Steel Chess se déroule chaque année à Wijk aan Zee et reste l’un des opens élite les plus suivis.',
    i18nEn: {
      question: 'Where is the Tata Steel Chess tournament traditionally played?',
      answers: ['Wijk aan Zee (Netherlands)', 'Reykjavik', 'Las Vegas', 'Doha'],
      explanation:
        'Tata Steel Chess is held each year in Wijk aan Zee and remains one of the most followed elite opens.',
    },
  }),
  q({
    id: 'modern-011',
    category: 'modern-chess',
    subcategory: 'tournaments',
    difficulty: 2,
    tags: ['norway-chess'],
    sourceType: 'historical-fact',
    question: 'Quel grand tournoi élite se joue régulièrement en Norvège depuis les années 2010 ?',
    answers: ['Norway Chess', 'Lone Pine', 'AVRO 1938', 'Hastings 1895'],
    correctAnswer: 0,
    explanation:
      'Norway Chess, souvent à Stavanger, est un rendez-vous élite moderne associé notamment à Carlsen.',
    i18nEn: {
      question: 'Which major elite tournament has been played regularly in Norway since the 2010s?',
      answers: ['Norway Chess', 'Lone Pine', 'AVRO 1938', 'Hastings 1895'],
      explanation:
        'Norway Chess, often in Stavanger, is a modern elite fixture closely associated with Carlsen.',
    },
  }),
  q({
    id: 'modern-012',
    category: 'modern-chess',
    subcategory: 'tournaments',
    difficulty: 2,
    tags: ['sinquefield'],
    sourceType: 'historical-fact',
    question: 'Dans quelle ville américaine se joue la Sinquefield Cup ?',
    answers: ['Saint-Louis', 'New York', 'Los Angeles', 'Chicago'],
    correctAnswer: 0,
    explanation:
      'La Sinquefield Cup fait partie du circuit élite organisé autour du club de Saint-Louis.',
    i18nEn: {
      question: 'In which American city is the Sinquefield Cup played?',
      answers: ['Saint Louis', 'New York', 'Los Angeles', 'Chicago'],
      explanation:
        'The Sinquefield Cup is part of the elite circuit centered on the Saint Louis Chess Club.',
    },
  }),
  q({
    id: 'modern-013',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['firouzja'],
    sourceType: 'historical-fact',
    question:
      'Quel prodige né en 2003 a longtemps représenté la France avant de jouer sous drapeaux différents selon les périodes ?',
    answers: [
      'Alireza Firouzja',
      'Garry Kasparov',
      'Anatoly Karpov',
      'Paul Morphy',
    ],
    correctAnswer: 0,
    explanation:
      'Firouzja, prodige iranien puis français (puis changement de fédération selon les périodes), s’est imposé parmi l’élite mondiale dans les années 2020.',
    i18nEn: {
      question:
        'Which 2003-born prodigy long represented France and has changed federations across periods of his career?',
      answers: [
        'Alireza Firouzja',
        'Garry Kasparov',
        'Anatoly Karpov',
        'Paul Morphy',
      ],
      explanation:
        'Firouzja, an Iranian-born prodigy who represented France (with later federation changes), broke into the world elite in the 2020s.',
    },
  }),
  q({
    id: 'modern-014',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['ju-wenjun'],
    sourceType: 'historical-fact',
    question:
      'Quelle joueuse chinoise a dominé le Championnat du monde féminin à partir de 2018 ?',
    answers: ['Ju Wenjun', 'Judit Polgár', 'Maia Chiburdanidze', 'Nona Gaprindashvili'],
    correctAnswer: 0,
    explanation:
      'Ju Wenjun a conquis le titre féminin en 2018 et l’a défendu à plusieurs reprises dans les cycles suivants.',
    i18nEn: {
      question: 'Which Chinese player has dominated the Women’s World Championship from 2018 onward?',
      answers: ['Ju Wenjun', 'Judit Polgár', 'Maia Chiburdanidze', 'Nona Gaprindashvili'],
      explanation:
        'Ju Wenjun won the women’s title in 2018 and defended it across subsequent cycles.',
    },
  }),
  q({
    id: 'modern-015',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['hou-yifan'],
    sourceType: 'historical-fact',
    question:
      'Quelle championne chinoise est souvent citée comme l’une des plus fortes joueuses de l’histoire moderne ?',
    answers: ['Hou Yifan', 'Vera Menchik', 'Susan Polgar', 'Anna Muzychuk'],
    correctAnswer: 0,
    explanation:
      'Hou Yifan a été championne du monde féminine multiple et reste une référence de l’élite féminine du XXIe siècle.',
    i18nEn: {
      question:
        'Which Chinese champion is often cited among the strongest women players in modern history?',
      answers: ['Hou Yifan', 'Vera Menchik', 'Susan Polgar', 'Anna Muzychuk'],
      explanation:
        'Hou Yifan was a multiple Women’s World Champion and remains a landmark figure of 21st-century women’s chess.',
    },
  }),
  q({
    id: 'modern-016',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 3,
    tags: ['praggnanandhaa', 'candidates'],
    sourceType: 'historical-fact',
    question:
      'Quel prodige indien a notamment atteint le Tournoi des candidats au début des années 2020 ?',
    answers: [
      'R. Praggnanandhaa',
      'Paul Keres',
      'Efim Geller',
      'Miguel Najdorf',
    ],
    correctAnswer: 0,
    explanation:
      'Praggnanandhaa s’est hissé parmi l’élite mondiale et a participé au cycle des Candidats de sa génération.',
    i18nEn: {
      question:
        'Which Indian prodigy notably reached the Candidates Tournament in the early 2020s?',
      answers: [
        'R. Praggnanandhaa',
        'Paul Keres',
        'Efim Geller',
        'Miguel Najdorf',
      ],
      explanation:
        'Praggnanandhaa rose into the world elite and played in his generation’s Candidates cycle.',
    },
  }),
  q({
    id: 'modern-017',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['abdusattorov'],
    sourceType: 'historical-fact',
    question:
      'Quel grand maître ouzbek a remporté le Championnat du monde de rapide FIDE en 2021 ?',
    answers: [
      'Nodirbek Abdusattorov',
      'Rustam Kasimdzhanov',
      'Shakhriyar Mamedyarov',
      'Teimour Radjabov',
    ],
    correctAnswer: 0,
    explanation:
      'Abdusattorov a créé la surprise en remportant le titre mondial de rapide 2021 à Varsovie.',
    i18nEn: {
      question: 'Which Uzbek grandmaster won the FIDE World Rapid Championship in 2021?',
      answers: [
        'Nodirbek Abdusattorov',
        'Rustam Kasimdzhanov',
        'Shakhriyar Mamedyarov',
        'Teimour Radjabov',
      ],
      explanation:
        'Abdusattorov shocked the field by winning the 2021 World Rapid title in Warsaw.',
    },
  }),
  q({
    id: 'modern-018',
    category: 'modern-chess',
    subcategory: 'culture',
    difficulty: 2,
    tags: ['online-boom', '2020'],
    sourceType: 'historical-fact',
    question:
      'Quel contexte a fortement accéléré le boom des échecs en ligne vers 2020 ?',
    answers: [
      'La pandémie de COVID-19 et la popularité accrue des plateformes/streaming',
      'L’interdiction du blitz OTB',
      'La disparition des tournois classiques',
      'Le retrait de toutes les fédérations',
    ],
    correctAnswer: 0,
    explanation:
      'Confinement, séries/documentaires et streamers ont massivement élargi le public des plateformes en ligne.',
    i18nEn: {
      question: 'What context strongly accelerated the online chess boom around 2020?',
      answers: [
        'The COVID-19 pandemic and the rise of platforms/streaming',
        'A ban on over-the-board blitz',
        'The disappearance of classical tournaments',
        'All federations withdrawing',
      ],
      explanation:
        'Lockdowns, shows/documentaries, and streamers massively expanded the audience for online platforms.',
    },
  }),
  q({
    id: 'modern-019',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['wesley-so'],
    sourceType: 'historical-fact',
    question:
      'Quel grand maître né aux Philippines est devenu un pilier de l’équipe américaine dans les années 2010–2020 ?',
    answers: ['Wesley So', 'Emanuel Lasker', 'Akiba Rubinstein', 'David Bronstein'],
    correctAnswer: 0,
    explanation:
      'Wesley So, après avoir changé de fédération pour les USA, s’est affirmé comme un régulier du top mondial.',
    i18nEn: {
      question:
        'Which Philippines-born grandmaster became a pillar of the USA team in the 2010s–2020s?',
      answers: ['Wesley So', 'Emanuel Lasker', 'Akiba Rubinstein', 'David Bronstein'],
      explanation:
        'Wesley So, after switching federation to the USA, established himself as a regular world-elite player.',
    },
  }),
  q({
    id: 'modern-020',
    category: 'modern-chess',
    subcategory: 'players',
    difficulty: 2,
    tags: ['aronian'],
    sourceType: 'historical-fact',
    question:
      'Quel grand maître arménien a longtemps figuré dans l’élite mondiale et brillé en Coupe du monde / tournois rapides ?',
    answers: ['Levon Aronian', 'Tigran Petrosian', 'Garry Kasparov', 'Mikhail Botvinnik'],
    correctAnswer: 0,
    explanation:
      'Aronian a été un candidat régulier au titre et une figure majeure des années 2000–2020.',
    i18nEn: {
      question:
        'Which Armenian grandmaster long belonged to the world elite and shone in World Cups / rapid events?',
      answers: ['Levon Aronian', 'Tigran Petrosian', 'Garry Kasparov', 'Mikhail Botvinnik'],
      explanation:
        'Aronian was a regular title contender and a major figure of the 2000s–2020s.',
    },
  }),
  q({
    id: 'modern-021',
    category: 'modern-chess',
    subcategory: 'tournaments',
    difficulty: 2,
    tags: ['grand-swiss'],
    sourceType: 'stable-fact',
    question: 'À quoi sert principalement le FIDE Grand Swiss moderne ?',
    answers: [
      'Offrir une voie de qualification vers le Tournoi des candidats',
      'Remplacer entièrement les Olympiades',
      'Décerner uniquement le titre de champion de blitz national',
      'Classer les problèmes d’échecs artistiques',
    ],
    correctAnswer: 0,
    explanation:
      'Le Grand Swiss est un open élite dont les meilleurs résultats ouvrent des places pour le cycle des Candidats.',
    i18nEn: {
      question: 'What is the main role of the modern FIDE Grand Swiss?',
      answers: [
        'To provide a qualification path toward the Candidates Tournament',
        'To fully replace the Olympiads',
        'To award only a national blitz title',
        'To rank artistic chess compositions',
      ],
      explanation:
        'The Grand Swiss is an elite open whose top finishes can earn spots in the Candidates cycle.',
    },
  }),
  q({
    id: 'modern-022',
    category: 'modern-chess',
    subcategory: 'world-championship',
    difficulty: 3,
    tags: ['carlsen', '2023'],
    sourceType: 'historical-fact',
    question:
      'Pourquoi le match mondial 2023 n’a-t-il pas opposé Carlsen à Nepomniachtchi ?',
    answers: [
      'Carlsen a choisi de ne pas défendre son titre',
      'Nepomniachtchi s’est retiré avant le match',
      'La FIDE a annulé le titre classique',
      'Carlsen a perdu les Candidats 2022',
    ],
    correctAnswer: 0,
    explanation:
      'Carlsen a annoncé qu’il ne défendrait pas son titre ; le match a donc opposé Nepomniachtchi à Ding Liren.',
    i18nEn: {
      question: 'Why was the 2023 world championship match not Carlsen vs Nepomniachtchi?',
      answers: [
        'Carlsen chose not to defend his title',
        'Nepomniachtchi withdrew before the match',
        'FIDE abolished the classical title',
        'Carlsen lost the 2022 Candidates',
      ],
      explanation:
        'Carlsen announced he would not defend his title, so the match became Nepomniachtchi vs Ding Liren.',
    },
  }),
];
