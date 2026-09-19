/**
 * Canonical Culture générale questions. Generated from the 500-question dossier.
 * Do not hand-edit entries; change the source bank instead.
 */
import type { ChessCultureQuestion } from '../types.ts';

export const QUESTIONS: ChessCultureQuestion[] = [
  {
    id: "position-mate-004zI",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame h6 → h8", "Dame h6 → g6", "Dame h6 → f8", "Dame h6 → g7"],
    correctAnswer: 0,
    explanation: "Mat : Dame h6 → h8. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-1", "endgame", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2q3k1/4br2/6pQ/1p1n2p1/7P/1P4P1/1B2PP2/6K1 w - - 0 28",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/004zI"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["h6h8", "h6g6", "h6f8", "h6g7"],
      principalLine: ["h6h8"],
      puzzleId: "004zI"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Queen h6 → h8", "Queen h6 → g6", "Queen h6 → f8", "Queen h6 → g7"],
      explanation: "Mate: Queen h6 → h8. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-00Elq",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame g5 → f6", "Dame g5 → d5", "Dame g5 → a5", "Dame g5 → g6"],
    correctAnswer: 3,
    explanation: "Mat : Dame g5 → g6. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rn3q1r/4pk2/2pp1npp/p5Q1/1p1PPNP1/5P2/PPP5/R4KNR w - - 0 18",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/00Elq"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["g5f6", "g5d5", "g5a5", "g5g6"],
      principalLine: ["g5g6"],
      puzzleId: "00Elq"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Queen g5 → f6", "Queen g5 → d5", "Queen g5 → a5", "Queen g5 → g6"],
      explanation: "Mate: Queen g5 → g6. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-00fpk",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Cavalier f6 → e4", "Cavalier g4 → e3", "Dame b8 → h2", "Fou b7 → e4"],
    correctAnswer: 2,
    explanation: "Mat : Dame b8 → h2. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rq2kb1r/1b1p1pp1/p3pn2/1p5p/4P1n1/1NN1BB1P/PPP1QPP1/R4RK1 b kq - 0 14",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/00fpk"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["f6e4", "g4e3", "b8h2", "b7e4"],
      principalLine: ["b8h2"],
      puzzleId: "00fpk"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Knight f6 → e4", "Knight g4 → e3", "Queen b8 → h2", "Bishop b7 → e4"],
      explanation: "Mate: Queen b8 → h2. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-00HoG",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame g6 → g7", "Dame g6 → h7", "Dame g6 → f6", "Dame g6 → h6"],
    correctAnswer: 1,
    explanation: "Mat : Dame g6 → h7. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "5r1k/8/2b2rQp/1p1p2p1/1q4P1/8/8/1B3R1K w - - 0 37",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/00HoG"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["g6g7", "g6h7", "g6f6", "g6h6"],
      principalLine: ["g6h7"],
      puzzleId: "00HoG"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Queen g6 → g7", "Queen g6 → h7", "Queen g6 → f6", "Queen g6 → h6"],
      explanation: "Mate: Queen g6 → h7. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-00QY3",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame h3 → f1", "Dame h3 → f3", "Dame h3 → h2", "Dame h3 → g2"],
    correctAnswer: 0,
    explanation: "Mat : Dame h3 → f1. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "master", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2k3r1/pp5p/4p3/2p2p2/2P5/P4P1q/1PQ1R2R/7K b - - 0 32",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/00QY3"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["h3f1", "h3f3", "h3h2", "h3g2"],
      principalLine: ["h3f1"],
      puzzleId: "00QY3"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Queen h3 → f1", "Queen h3 → f3", "Queen h3 → h2", "Queen h3 → g2"],
      explanation: "Mate: Queen h3 → f1. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-00swU",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame d7 → d1", "Dame d7 → c8", "Dame d7 → d3", "Dame d7 → d2"],
    correctAnswer: 3,
    explanation: "Mat : Dame d7 → d2. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "oneMove", "opening"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3rkb1r/pppqp1pp/2n5/1QN2p2/8/1P2P3/PBP2PPP/R3KB1R b KQk - 1 12",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/00swU"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["d7d1", "d7c8", "d7d3", "d7d2"],
      principalLine: ["d7d2"],
      puzzleId: "00swU"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Queen d7 → d1", "Queen d7 → c8", "Queen d7 → d3", "Queen d7 → d2"],
      explanation: "Mate: Queen d7 → d2. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-00X5a",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame d5 → g2", "Dame d5 → a2", "Dame d5 → h5", "Dame d5 → f5"],
    correctAnswer: 2,
    explanation: "Mat : Dame d5 → h5. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-1", "endgame", "master", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3N3k/pQ5p/4p1p1/3q4/8/2b1P1PK/P3RP1P/4n3 b - - 2 28",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/00X5a"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["d5g2", "d5a2", "d5h5", "d5f5"],
      principalLine: ["d5h5"],
      puzzleId: "00X5a"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Queen d5 → g2", "Queen d5 → a2", "Queen d5 → h5", "Queen d5 → f5"],
      explanation: "Mate: Queen d5 → h5. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-00zDW",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour e7 → a7", "Dame g5 → g7", "Tour e7 → e8", "Dame g5 → d5"],
    correctAnswer: 1,
    explanation: "Mat : Dame g5 → g7. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "kingsideAttack", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "1r1r3k/p3R1pp/b1p5/2pq2Q1/8/2PPR2P/PP3PP1/6K1 w - - 3 27",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/00zDW"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["e7a7", "g5g7", "e7e8", "g5d5"],
      principalLine: ["g5g7"],
      puzzleId: "00zDW"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Rook e7 → a7", "Queen g5 → g7", "Rook e7 → e8", "Queen g5 → d5"],
      explanation: "Mate: Queen g5 → g7. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-01dgp",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame d5 → a8", "Dame d5 → b7", "Dame d5 → b5", "Dame d5 → d4"],
    correctAnswer: 0,
    explanation: "Mat : Dame d5 → a8. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2kr3r/2pbqp2/p2p3p/1p1Q2p1/3b4/BP2P2P/P1P2PP1/2R2RK1 w - - 0 22",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/01dgp"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["d5a8", "d5b7", "d5b5", "d5d4"],
      principalLine: ["d5a8"],
      puzzleId: "01dgp"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Queen d5 → a8", "Queen d5 → b7", "Queen d5 → b5", "Queen d5 → d4"],
      explanation: "Mate: Queen d5 → a8. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-01iWy",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame b4 → b6", "Dame b4 → c5", "Dame b4 → d2", "Dame b4 → f4"],
    correctAnswer: 3,
    explanation: "Mat : Dame b4 → f4. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1b5/ppp3pp/3k4/4p2Q/1q5P/3BK3/P3R3/4R3 b - - 10 30",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/01iWy"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["b4b6", "b4c5", "b4d2", "b4f4"],
      principalLine: ["b4f4"],
      puzzleId: "01iWy"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Queen b4 → b6", "Queen b4 → c5", "Queen b4 → d2", "Queen b4 → f4"],
      explanation: "Mate: Queen b4 → f4. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-01pz8",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame d6 → a6", "Dame d6 → e6", "Dame d6 → f8", "Tour d7 → h7"],
    correctAnswer: 2,
    explanation: "Mat : Dame d6 → f8. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "hangingPiece", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "5r2/1p1R4/p2Qq1pk/4P2p/3P1n1P/8/PP5K/8 w - - 1 36",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/01pz8"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["d6a6", "d6e6", "d6f8", "d7h7"],
      principalLine: ["d6f8"],
      puzzleId: "01pz8"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Queen d6 → a6", "Queen d6 → e6", "Queen d6 → f8", "Rook d7 → h7"],
      explanation: "Mate: Queen d6 → f8. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-02Idw",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Cavalier f6 → d5", "Dame h6 → h3", "Dame h6 → h1", "Dame h6 → h2"],
    correctAnswer: 1,
    explanation: "Mat : Dame h6 → h3. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "master", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "6k1/1p6/3p1n1q/1P1PpQ2/P3P1p1/3Bb1P1/2N3K1/8 b - - 2 50",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/02Idw"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["f6d5", "h6h3", "h6h1", "h6h2"],
      principalLine: ["h6h3"],
      puzzleId: "02Idw"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Knight f6 → d5", "Queen h6 → h3", "Queen h6 → h1", "Queen h6 → h2"],
      explanation: "Mate: Queen h6 → h3. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-02ynf",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour d8 → d1", "Cavalier h1 → g3", "Fou e6 → a2", "Tour d8 → d2"],
    correctAnswer: 0,
    explanation: "Mat : Tour d8 → d1. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2kr3r/pp3pQp/2n1b3/1B6/4PB2/8/PPP1NbPP/3N1K1n b - - 0 16",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/02ynf"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["d8d1", "h1g3", "e6a2", "d8d2"],
      principalLine: ["d8d1"],
      puzzleId: "02ynf"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Rook d8 → d1", "Knight h1 → g3", "Bishop e6 → a2", "Rook d8 → d2"],
      explanation: "Mate: Rook d8 → d1. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-03lYh",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Roi b3 → a4", "Roi b3 → b4", "Roi b3 → c3", "Pion a3 → a2"],
    correctAnswer: 3,
    explanation: "Mat : Pion a3 → a2. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "advancedPawn", "endgame", "master", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "7Q/8/5n2/8/8/pk6/1p6/1K6 b - - 0 56",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/03lYh"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["b3a4", "b3b4", "b3c3", "a3a2"],
      principalLine: ["a3a2"],
      puzzleId: "03lYh"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["King b3 → a4", "King b3 → b4", "King b3 → c3", "Pawn a3 → a2"],
      explanation: "Mate: Pawn a3 → a2. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-03M4A",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame e4 → e8", "Dame e4 → g6", "Tour c5 → c8", "Dame e4 → b7"],
    correctAnswer: 2,
    explanation: "Mat : Tour c5 → c8. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "master", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "k7/pr3p1p/6p1/2R5/q2PQP2/P3P3/1n4P1/K7 w - - 2 44",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/03M4A"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["e4e8", "e4g6", "c5c8", "e4b7"],
      principalLine: ["c5c8"],
      puzzleId: "03M4A"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Queen e4 → e8", "Queen e4 → g6", "Rook c5 → c8", "Queen e4 → b7"],
      explanation: "Mate: Rook c5 → c8. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-03pLv",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Cavalier g4 → h2", "Cavalier g4 → e3", "Cavalier g4 → e5", "Cavalier g4 → f6"],
    correctAnswer: 1,
    explanation: "Mat : Cavalier g4 → e3. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-1", "endgame", "knightEndgame", "master", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "8/5n2/p3p3/1p6/1Pk3N1/2P4p/P2K1P2/8 w - - 0 45",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/03pLv"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["g4h2", "g4e3", "g4e5", "g4f6"],
      principalLine: ["g4e3"],
      puzzleId: "03pLv"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Knight g4 → h2", "Knight g4 → e3", "Knight g4 → e5", "Knight g4 → f6"],
      explanation: "Mate: Knight g4 → e3. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-03Ria",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour d4 → e4", "Tour d4 → d3", "Pion f5 → f4", "Tour d4 → h4"],
    correctAnswer: 0,
    explanation: "Mat : Tour d4 → e4. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-1", "endgame", "master", "masterVsMaster", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3r4/5k1p/2p1p3/1p3p2/3r3P/1P2KN2/2P2PP1/2R4R b - - 3 32",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/03Ria"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["d4e4", "d4d3", "f5f4", "d4h4"],
      principalLine: ["d4e4"],
      puzzleId: "03Ria"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Rook d4 → e4", "Rook d4 → d3", "Pawn f5 → f4", "Rook d4 → h4"],
      explanation: "Mate: Rook d4 → e4. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-04dnJ",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour d8 → d1", "Cavalier a5 → c4", "Cavalier a5 → c6", "Cavalier a5 → b3"],
    correctAnswer: 3,
    explanation: "Mat : Cavalier a5 → b3. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3rkb1r/1p2npp1/p6p/n1p1Pb2/P1N2B1P/2P2N2/1P3PP1/R1K2B1R b k - 2 14",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/04dnJ"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["d8d1", "a5c4", "a5c6", "a5b3"],
      principalLine: ["a5b3"],
      puzzleId: "04dnJ"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Rook d8 → d1", "Knight a5 → c4", "Knight a5 → c6", "Knight a5 → b3"],
      explanation: "Mate: Knight a5 → b3. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-05MRH",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame g4 → e2", "Dame g4 → f5", "Dame g4 → d1", "Cavalier c6 → d4"],
    correctAnswer: 2,
    explanation: "Mat : Dame g4 → d1. Thème : réseau de mat avec cases de fuite bloquées. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-1", "dovetailMate", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "6k1/ppp2p1p/2n3p1/2NB4/3P1QqP/2P3B1/PPK2P2/4r3 b - - 5 29",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/05MRH"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["g4e2", "g4f5", "g4d1", "c6d4"],
      principalLine: ["g4d1"],
      puzzleId: "05MRH"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Queen g4 → e2", "Queen g4 → f5", "Queen g4 → d1", "Knight c6 → d4"],
      explanation: "Mate: Queen g4 → d1. Theme: mate with blocked escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-05zfA",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour a1 → b1", "Tour e1 → e8", "Fou d3 → h7", "Fou c1 → h6"],
    correctAnswer: 1,
    explanation: "Mat : Tour e1 → e8. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "hangingPiece", "kingsideAttack", "mate", "mateIn1", "middlegame", "oneMove", "pillsburysMate"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1b1r1k1/pp3pp1/1q5p/3n4/3P4/2PB1N2/PP3KPP/R1B1R3 w - - 0 17",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/05zfA"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["a1b1", "e1e8", "d3h7", "c1h6"],
      principalLine: ["e1e8"],
      puzzleId: "05zfA"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Rook a1 → b1", "Rook e1 → e8", "Bishop d3 → h7", "Bishop c1 → h6"],
      explanation: "Mate: Rook e1 → e8. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-06man",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Cavalier e5 → g6", "Dame h5 → h7", "Cavalier e5 → f7", "Cavalier e5 → c6"],
    correctAnswer: 0,
    explanation: "Mat : Cavalier e5 → g6. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove", "pin"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bq1r1k/1n4pp/2p5/1p2N2Q/1P6/PB5P/3N1bP1/R3n2K w - - 0 23",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/06man"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["e5g6", "h5h7", "e5f7", "e5c6"],
      principalLine: ["e5g6"],
      puzzleId: "06man"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Knight e5 → g6", "Queen h5 → h7", "Knight e5 → f7", "Knight e5 → c6"],
      explanation: "Mate: Knight e5 → g6. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-06nDf",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame a1 → g7", "Dame a1 → h8", "Tour e1 → b1", "Tour e1 → e8"],
    correctAnswer: 3,
    explanation: "Mat : Tour e1 → e8. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "master", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1b3k1/p4p1p/2p3p1/3n4/8/3q2BP/P4PP1/Q3R1K1 w - - 2 20",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/06nDf"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["a1g7", "a1h8", "e1b1", "e1e8"],
      principalLine: ["e1e8"],
      puzzleId: "06nDf"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Queen a1 → g7", "Queen a1 → h8", "Rook e1 → b1", "Rook e1 → e8"],
      explanation: "Mate: Rook e1 → e8. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-06pPG",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour a3 → a2", "Tour a3 → a4", "Tour a3 → d3", "Tour a3 → a1"],
    correctAnswer: 2,
    explanation: "Mat : Tour a3 → d3. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "8/p7/3k1p2/3p4/1PpK2BP/r7/4R3/8 b - - 2 53",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/06pPG"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["a3a2", "a3a4", "a3d3", "a3a1"],
      principalLine: ["a3d3"],
      puzzleId: "06pPG"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Rook a3 → a2", "Rook a3 → a4", "Rook a3 → d3", "Rook a3 → a1"],
      explanation: "Mate: Rook a3 → d3. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-074gl",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame g2 → h3", "Tour c7 → h7", "Dame g2 → g4", "Dame g2 → h2"],
    correctAnswer: 1,
    explanation: "Mat : Tour c7 → h7. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "mate", "mateIn1", "oneMove", "pillsburysMate"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r7/ppR5/8/3q1P1k/1P3Bp1/5n2/P5Q1/7K w - - 4 39",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/074gl"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["g2h3", "c7h7", "g2g4", "g2h2"],
      principalLine: ["c7h7"],
      puzzleId: "074gl"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Queen g2 → h3", "Rook c7 → h7", "Queen g2 → g4", "Queen g2 → h2"],
      explanation: "Mate: Rook c7 → h7. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-07faR",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Cavalier e4 → d6", "Dame h8 → f8", "Cavalier e4 → f6", "Fou h6 → f8"],
    correctAnswer: 0,
    explanation: "Mat : Cavalier e4 → d6. Thème : mat à l’étouffée. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove", "pin", "smotheredMate"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r2qkb1Q/pp1npp1p/2p3pB/3n4/2b1N3/8/PP3PPP/R3R1K1 w q - 0 15",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/07faR"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["e4d6", "h8f8", "e4f6", "h6f8"],
      principalLine: ["e4d6"],
      puzzleId: "07faR"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Knight e4 → d6", "Queen h8 → f8", "Knight e4 → f6", "Bishop h6 → f8"],
      explanation: "Mate: Knight e4 → d6. Theme: smothered mate. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-07h6q",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour e1 → c1", "Fou h6 → c1", "Tour e1 → d1", "Tour e1 → e8"],
    correctAnswer: 3,
    explanation: "Mat : Tour e1 → e8. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "mate", "mateIn1", "oneMove", "pillsburysMate"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "6k1/1p3p1p/1P4pB/p7/P5P1/2n2PK1/1q6/2q1R3 w - - 0 48",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/07h6q"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["e1c1", "h6c1", "e1d1", "e1e8"],
      principalLine: ["e1e8"],
      puzzleId: "07h6q"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Rook e1 → c1", "Bishop h6 → c1", "Rook e1 → d1", "Rook e1 → e8"],
      explanation: "Mate: Rook e1 → e8. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-07W7D",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame a3 → a2", "Dame a3 → g3", "Tour e7 → e1", "Dame a3 → c1"],
    correctAnswer: 2,
    explanation: "Mat : Tour e7 → e1. Thème : mat du couloir. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "backRankMate", "endgame", "master", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "8/p2kr3/2Rp2p1/1P1P1p2/5Q2/q5B1/P4PPP/6K1 b - - 2 38",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/07W7D"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["a3a2", "a3g3", "e7e1", "a3c1"],
      principalLine: ["e7e1"],
      puzzleId: "07W7D"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Queen a3 → a2", "Queen a3 → g3", "Rook e7 → e1", "Queen a3 → c1"],
      explanation: "Mate: Rook e7 → e1. Theme: back-rank mate. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-07WFH",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour c8 → b8", "Tour c8 → f8", "Tour c8 → c7", "Tour c8 → a8"],
    correctAnswer: 1,
    explanation: "Mat : Tour c8 → f8. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-1", "endgame", "master", "mate", "mateIn1", "oneMove", "operaMate"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2R5/5kpp/p5r1/1p1P4/4p3/B1P2n2/P4P1P/5K2 w - - 3 34",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/07WFH"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["c8b8", "c8f8", "c8c7", "c8a8"],
      principalLine: ["c8f8"],
      puzzleId: "07WFH"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Rook c8 → b8", "Rook c8 → f8", "Rook c8 → c7", "Rook c8 → a8"],
      explanation: "Mate: Rook c8 → f8. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-08SvM",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour f1 → f8", "Tour e1 → e8", "Fou d6 → c5", "Tour e1 → d1"],
    correctAnswer: 0,
    explanation: "Mat : Tour f1 → f8. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "mate", "mateIn1", "oneMove", "operaMate"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "6k1/3q2pp/pp1B2b1/2p5/6P1/3P3r/PPP5/2K1RR2 w - - 0 31",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/08SvM"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["f1f8", "e1e8", "d6c5", "e1d1"],
      principalLine: ["f1f8"],
      puzzleId: "08SvM"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Rook f1 → f8", "Rook e1 → e8", "Bishop d6 → c5", "Rook e1 → d1"],
      explanation: "Mate: Rook f1 → f8. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-098RM",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Fou e2 → a6", "Fou e2 → b5", "Fou e2 → c4", "Fou e2 → h5"],
    correctAnswer: 3,
    explanation: "Mat : Fou e2 → h5. Thème : diagonales croisées de deux fous. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "bodenMate", "mate", "mateIn1", "oneMove", "opening"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/ppppp2p/8/5p2/8/8/PPPPBPPP/RNBQK1NR w KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/098RM"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["e2a6", "e2b5", "e2c4", "e2h5"],
      principalLine: ["e2h5"],
      puzzleId: "098RM"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Bishop e2 → a6", "Bishop e2 → b5", "Bishop e2 → c4", "Bishop e2 → h5"],
      explanation: "Mate: Bishop e2 → h5. Theme: crossing bishop diagonals. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-09CcV",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour f7 → b7", "Roi b3 → c4", "Tour f7 → e7", "Tour f7 → f8"],
    correctAnswer: 2,
    explanation: "Mat : Tour f7 → e7. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-1", "endgame", "master", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3rk3/1p3R2/p1p3N1/2P5/2r5/1K1p4/PP6/8 w - - 0 44",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/09CcV"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["f7b7", "b3c4", "f7e7", "f7f8"],
      principalLine: ["f7e7"],
      puzzleId: "09CcV"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Rook f7 → b7", "King b3 → c4", "Rook f7 → e7", "Rook f7 → f8"],
      explanation: "Mate: Rook f7 → e7. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-09m6y",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Tour a2 → a3", "Tour a2 → a1", "Tour e2 → e1", "Tour e2 → f2"],
    correctAnswer: 1,
    explanation: "Mat : Tour a2 → a1. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "hangingPiece", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "5R2/6pk/3N3p/8/8/8/r3rPPP/R5K1 b - - 3 30",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/09m6y"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["a2a3", "a2a1", "e2e1", "e2f2"],
      principalLine: ["a2a1"],
      puzzleId: "09m6y"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Rook a2 → a3", "Rook a2 → a1", "Rook e2 → e1", "Rook e2 → f2"],
      explanation: "Mate: Rook a2 → a1. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-0A658",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Dame e4 → h1", "Dame e4 → b1", "Dame e4 → e1", "Dame e4 → c4"],
    correctAnswer: 0,
    explanation: "Mat : Dame e4 → h1. Thème : mat du couloir. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "backRankMate", "endgame", "hangingPiece", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2r3k1/p4p1p/2p3p1/2Q5/2N1q3/8/PP3P1P/K6R b - - 5 28",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/0A658"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["e4h1", "e4b1", "e4e1", "e4c4"],
      principalLine: ["e4h1"],
      puzzleId: "0A658"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Queen e4 → h1", "Queen e4 → b1", "Queen e4 → e1", "Queen e4 → c4"],
      explanation: "Mate: Queen e4 → h1. Theme: back-rank mate. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-0Aqug",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Fou c6 → f3", "Tour g7 → g2", "Cavalier d3 → b2", "Cavalier d3 → f2"],
    correctAnswer: 3,
    explanation: "Mat : Cavalier d3 → f2. Thème : mat à l’étouffée. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove", "smotheredMate"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "7k/p5rp/P1b2p2/1p2p3/2p5/B1PnPN2/6PP/R5RK b - - 0 30",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/0Aqug"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["c6f3", "g7g2", "d3b2", "d3f2"],
      principalLine: ["d3f2"],
      puzzleId: "0Aqug"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Bishop c6 → f3", "Rook g7 → g2", "Knight d3 → b2", "Knight d3 → f2"],
      explanation: "Mate: Knight d3 → f2. Theme: smothered mate. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-0B1aF",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Pion h6 → g5", "Fou h7 → e4", "Tour a8 → a1", "Dame d8 → g5"],
    correctAnswer: 2,
    explanation: "Mat : Tour a8 → a1. Thème : mat du couloir. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "backRankMate", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r2q1rk1/2pn1ppb/2np3p/3Np1PP/1p2P3/3PPN2/1PPQB3/2K3RR b - - 1 18",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/0B1aF"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["h6g5", "h7e4", "a8a1", "d8g5"],
      principalLine: ["a8a1"],
      puzzleId: "0B1aF"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["Pawn h6 → g5", "Bishop h7 → e4", "Rook a8 → a1", "Queen d8 → g5"],
      explanation: "Mate: Rook a8 → a1. Theme: back-rank mate. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-0CePY",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Roi g1 → g2", "Pion f6 → g7", "Cavalier e7 → g6", "Fou d4 → a7"],
    correctAnswer: 1,
    explanation: "Mat : Pion f6 → g7. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "advancedPawn", "master", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r6k/pp2Nnrp/5Pp1/8/3B4/8/P1qp2bP/R4RK1 w - - 0 27",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/0CePY"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["g1g2", "f6g7", "e7g6", "d4a7"],
      principalLine: ["f6g7"],
      puzzleId: "0CePY"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["King g1 → g2", "Pawn f6 → g7", "Knight e7 → g6", "Bishop d4 → a7"],
      explanation: "Mate: Pawn f6 → g7. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-0DIlf",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Fou e2 → d3", "Fou e2 → g4", "Fou e2 → h5", "Fou e2 → b5"],
    correctAnswer: 0,
    explanation: "Mat : Fou e2 → d3. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "8/5pp1/P1p1p3/4Pk1p/1p3P2/1P4K1/4B3/r7 w - - 6 38",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/0DIlf"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["e2d3", "e2g4", "e2h5", "e2b5"],
      principalLine: ["e2d3"],
      puzzleId: "0DIlf"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Bishop e2 → d3", "Bishop e2 → g4", "Bishop e2 → h5", "Bishop e2 → b5"],
      explanation: "Mate: Bishop e2 → d3. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-0FjzQ",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Cavalier d6 → f5", "Cavalier d6 → b5", "Cavalier d6 → b7", "Cavalier d6 → f7"],
    correctAnswer: 3,
    explanation: "Mat : Cavalier d6 → f7. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-1", "endgame", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "8/p5p1/3NR1Pk/7p/3P4/2pn2P1/r7/7K w - - 1 48",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/0FjzQ"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["d6f5", "d6b5", "d6b7", "d6f7"],
      principalLine: ["d6f7"],
      puzzleId: "0FjzQ"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Knight d6 → f5", "Knight d6 → b5", "Knight d6 → b7", "Knight d6 → f7"],
      explanation: "Mate: Knight d6 → f7. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-0FOiE",
    revision: 1,
    question: "Trait aux Blancs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Cavalier g4 → f6", "Fou d4 → a7", "Cavalier g4 → h6", "Fou c2 → h7"],
    correctAnswer: 2,
    explanation: "Mat : Cavalier g4 → h6. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "checkmates",
    difficulty: 2,
    tags: ["board", "mate-in-1", "mate", "mateIn1", "middlegame", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r4rk1/pp2n2p/2b5/3p3P/2pB2Nn/P1P5/1PB2P2/R4RK1 w - - 2 24",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/0FOiE"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["g4f6", "d4a7", "g4h6", "c2h7"],
      principalLine: ["g4h6"],
      puzzleId: "0FOiE"
    },
    i18nEn: {
      question: "White to move. Which move delivers checkmate immediately?",
      answers: ["Knight g4 → f6", "Bishop d4 → a7", "Knight g4 → h6", "Bishop c2 → h7"],
      explanation: "Mate: Knight g4 → h6. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-0GePL",
    revision: 1,
    question: "Trait aux Noirs. Quel coup donne échec et mat immédiatement ?",
    answers: ["Roi g4 → h5", "Fou b7 → e4", "Roi g4 → g5", "Roi g4 → h3"],
    correctAnswer: 1,
    explanation: "Mat : Fou b7 → e4. Thème : coordination des pièces et contrôle des cases de fuite. Le roi adverse est en échec et aucune réponse légale ne subsiste.",
    category: "endgames",
    difficulty: 2,
    tags: ["board", "mate-in-1", "endgame", "hangingPiece", "master", "mate", "mateIn1", "oneMove"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "8/Pb6/8/8/4Q1k1/6p1/7p/7K b - - 3 66",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/0GePL"],
    verification: {
      kind: "mate",
      movesToMate: 1,
      answerMoves: ["g4h5", "b7e4", "g4g5", "g4h3"],
      principalLine: ["b7e4"],
      puzzleId: "0GePL"
    },
    i18nEn: {
      question: "Black to move. Which move delivers checkmate immediately?",
      answers: ["King g4 → h5", "Bishop b7 → e4", "King g4 → g5", "King g4 → h3"],
      explanation: "Mate: Bishop b7 → e4. Theme: piece coordination and control of escape squares. The king is in check and has no legal reply."
    }
  },
  {
    id: "position-mate-005nD",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame c6 → e6", "Dame c6 → d7", "Tour f1 → f8", "Dame c6 → a6"],
    correctAnswer: 0,
    explanation: "Une ligne de mat : Dame c6 → e6 ; Cavalier d5 → e7 ; Dame e6 → f7. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "fork", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3rk2r/2qn2p1/p1Q1p3/3n3p/8/8/PP4PP/5R1K w k - 0 24",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/005nD"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["c6e6", "c6d7", "f1f8", "c6a6"],
      principalLine: ["c6e6", "d5e7", "e6f7"],
      puzzleId: "005nD"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen c6 → e6", "Queen c6 → d7", "Rook f1 → f8", "Queen c6 → a6"],
      explanation: "One mating line: Queen c6 → e6; Knight d5 → e7; Queen e6 → f7. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-009zR",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Cavalier d2 → f1", "Tour b2 → a2", "Dame c2 → d1", "Cavalier d2 → f3"],
    correctAnswer: 3,
    explanation: "Une ligne de mat : Cavalier d2 → f3 ; Roi g1 → h1 ; Dame c2 → g2. Thème : attaque à la découverte. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-2", "discoveredAttack", "endgame", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3Q4/p1p2ppp/4k3/8/5P2/4P3/Prqn2PP/3R1RK1 b - - 0 22",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/009zR"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["d2f1", "b2a2", "c2d1", "d2f3"],
      principalLine: ["d2f3", "g1h1", "c2g2"],
      puzzleId: "009zR"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Knight d2 → f1", "Rook b2 → a2", "Queen c2 → d1", "Knight d2 → f3"],
      explanation: "One mating line: Knight d2 → f3; King g1 → h1; Queen c2 → g2. Theme: discovered attack. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-00EEp",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame f4 → g5", "Dame f4 → c1", "Dame f4 → f8", "Dame f4 → f6"],
    correctAnswer: 2,
    explanation: "Une ligne de mat : Dame f4 → f8 ; Dame g8 → f8 ; Tour f1 → f8. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-2", "endgame", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3k2q1/p2p3p/1p1P4/2p5/2P2Q1K/8/P5b1/5R2 w - - 3 37",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/00EEp"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["f4g5", "f4c1", "f4f8", "f4f6"],
      principalLine: ["f4f8", "g8f8", "f1f8"],
      puzzleId: "00EEp"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen f4 → g5", "Queen f4 → c1", "Queen f4 → f8", "Queen f4 → f6"],
      explanation: "One mating line: Queen f4 → f8; Queen g8 → f8; Rook f1 → f8. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-00pER",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame b3 → b4", "Dame b3 → g8", "Cavalier e7 → g6", "Cavalier g5 → f7"],
    correctAnswer: 1,
    explanation: "Une ligne de mat : Dame b3 → g8 ; Tour f8 → g8 ; Cavalier g5 → f7. Thème : mat à l’étouffée. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "kingsideAttack", "mate", "mateIn2", "middlegame", "sacrifice", "short", "smotheredMate"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r2q1r1k/4N1bp/p2p2p1/2p3N1/Pp4P1/1Q5P/1P1n1P2/5RK1 w - - 1 22",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/00pER"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["b3b4", "b3g8", "e7g6", "g5f7"],
      principalLine: ["b3g8", "f8g8", "g5f7"],
      puzzleId: "00pER"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen b3 → b4", "Queen b3 → g8", "Knight e7 → g6", "Knight g5 → f7"],
      explanation: "One mating line: Queen b3 → g8; Rook f8 → g8; Knight g5 → f7. Theme: smothered mate. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-00s7Y",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame g4 → c8", "Dame g4 → g7", "Fou d5 → f7", "Dame g4 → a4"],
    correctAnswer: 0,
    explanation: "Une ligne de mat : Dame g4 → c8 ; Dame b6 → d8 ; Dame c8 → d8. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-2", "endgame", "mate", "mateIn2", "pin", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "6k1/5rpp/1q1p4/2pB4/6Q1/2b4P/Pr4P1/6K1 w - - 0 30",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/00s7Y"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["g4c8", "g4g7", "d5f7", "g4a4"],
      principalLine: ["g4c8", "b6d8", "c8d8"],
      puzzleId: "00s7Y"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen g4 → c8", "Queen g4 → g7", "Bishop d5 → f7", "Queen g4 → a4"],
      explanation: "One mating line: Queen g4 → c8; Queen b6 → d8; Queen c8 → d8. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-00TFd",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Tour a2 → h2", "Pion a6 → a5", "Pion h5 → h4", "Pion g5 → g4"],
    correctAnswer: 3,
    explanation: "Une ligne de mat : Pion g5 → g4 ; Roi h3 → h4 ; Tour a2 → h2. Thème : déviation d’un défenseur. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-2", "deflection", "endgame", "mate", "mateIn2", "rookEndgame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "1R6/2P5/p5k1/6pp/1P6/6PK/r6P/8 b - - 0 40",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/00TFd"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["a2h2", "a6a5", "h5h4", "g5g4"],
      principalLine: ["g5g4", "h3h4", "a2h2"],
      puzzleId: "00TFd"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Rook a2 → h2", "Pawn a6 → a5", "Pawn h5 → h4", "Pawn g5 → g4"],
      explanation: "One mating line: Pawn g5 → g4; King h3 → h4; Rook a2 → h2. Theme: deflection of a defender. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-00xgR",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame e1 → a1", "Dame e1 → a5", "Dame e1 → f2", "Dame e1 → f1"],
    correctAnswer: 2,
    explanation: "Une ligne de mat : Dame e1 → f2 ; Roi g1 → h1 ; Dame f2 → f1. Thème : déviation d’un défenseur. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-2", "deflection", "endgame", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "4Q3/2B3k1/4p2p/2P3p1/3P4/4p3/6PP/4qNK1 b - - 1 34",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/00xgR"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["e1a1", "e1a5", "e1f2", "e1f1"],
      principalLine: ["e1f2", "g1h1", "f2f1"],
      puzzleId: "00xgR"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen e1 → a1", "Queen e1 → a5", "Queen e1 → f2", "Queen e1 → f1"],
      explanation: "One mating line: Queen e1 → f2; King g1 → h1; Queen f2 → f1. Theme: deflection of a defender. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-00zQz",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Fou g4 → c8", "Fou g4 → h3", "Tour e8 → e1", "Fou g4 → e2"],
    correctAnswer: 1,
    explanation: "Une ligne de mat : Fou g4 → h3 ; Roi f1 → g1 ; Tour e8 → e1. Thème : déviation d’un défenseur. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "deflection", "mate", "mateIn2", "middlegame", "pillsburysMate", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "4rrk1/pB4pp/2N2p2/2p5/6b1/1PN3P1/P1P2P1P/4RK2 b - - 0 21",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/00zQz"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["g4c8", "g4h3", "e8e1", "g4e2"],
      principalLine: ["g4h3", "f1g1", "e8e1"],
      puzzleId: "00zQz"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Bishop g4 → c8", "Bishop g4 → h3", "Rook e8 → e1", "Bishop g4 → e2"],
      explanation: "One mating line: Bishop g4 → h3; King f1 → g1; Rook e8 → e1. Theme: deflection of a defender. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-012LI",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Tour d4 → a4", "Pion b5 → b4", "Fou e6 → b3", "Tour d4 → b4"],
    correctAnswer: 0,
    explanation: "Une ligne de mat : Tour d4 → a4 ; Pion b3 → a4 ; Pion b5 → b4. Thème : sacrifice pour ouvrir le réseau de mat. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 4,
    tags: ["board", "mate-in-2", "endgame", "master", "mate", "mateIn2", "sacrifice", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "6k1/p4p1p/4bp2/1p2p3/3r4/KP1nQPN1/P7/5B2 b - - 1 33",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/012LI"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["d4a4", "b5b4", "e6b3", "d4b4"],
      principalLine: ["d4a4", "b3a4", "b5b4"],
      puzzleId: "012LI"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Rook d4 → a4", "Pawn b5 → b4", "Bishop e6 → b3", "Rook d4 → b4"],
      explanation: "One mating line: Rook d4 → a4; Pawn b3 → a4; Pawn b5 → b4. Theme: sacrifice to open the mating net. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-015Di",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Cavalier e5 → d7", "Pion c3 → d4", "Fou f7 → g8", "Cavalier e5 → c6"],
    correctAnswer: 3,
    explanation: "Une ligne de mat : Cavalier e5 → c6 ; Fou g2 → c6 ; Dame e2 → e8. Thème : sacrifice pour ouvrir le réseau de mat. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 4,
    tags: ["board", "mate-in-2", "clearance", "mate", "mateIn2", "opening", "sacrifice", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r2k1bnr/p1pp1Bpp/1p6/4N1q1/3p4/2P5/PP2QPbP/RN2K2R w KQ - 0 11",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/015Di"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["e5d7", "c3d4", "f7g8", "e5c6"],
      principalLine: ["e5c6", "g2c6", "e2e8"],
      puzzleId: "015Di"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Knight e5 → d7", "Pawn c3 → d4", "Bishop f7 → g8", "Knight e5 → c6"],
      explanation: "One mating line: Knight e5 → c6; Bishop g2 → c6; Queen e2 → e8. Theme: sacrifice to open the mating net. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-01EUl",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Fou g4 → h3", "Cavalier f6 → e4", "Fou d4 → c3", "Fou d4 → f2"],
    correctAnswer: 2,
    explanation: "Une ligne de mat : Fou d4 → c3 ; Dame g3 → c3 ; Dame d8 → d1. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "clearance", "mate", "mateIn2", "opening", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r2qk2r/ppp2pp1/2p2n2/7p/3bP1b1/2N3QP/PPP2PP1/R1B1KB1R b KQkq - 0 9",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/01EUl"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["g4h3", "f6e4", "d4c3", "d4f2"],
      principalLine: ["d4c3", "g3c3", "d8d1"],
      puzzleId: "01EUl"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Bishop g4 → h3", "Knight f6 → e4", "Bishop d4 → c3", "Bishop d4 → f2"],
      explanation: "One mating line: Bishop d4 → c3; Queen g3 → c3; Queen d8 → d1. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-01hRk",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Pion b7 → b5", "Pion h5 → h4", "Pion a7 → a5", "Pion a7 → a6"],
    correctAnswer: 1,
    explanation: "Une ligne de mat : Pion h5 → h4 ; Roi g3 → f3 ; Cavalier c2 → d4. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3k3r/ppNb4/3B1p2/6pp/2B1P1n1/3P2KP/PPn3P1/7R b - - 0 19",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/01hRk"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["b7b5", "h5h4", "a7a5", "a7a6"],
      principalLine: ["h5h4", "g3f3", "c2d4"],
      puzzleId: "01hRk"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Pawn b7 → b5", "Pawn h5 → h4", "Pawn a7 → a5", "Pawn a7 → a6"],
      explanation: "One mating line: Pawn h5 → h4; King g3 → f3; Knight c2 → d4. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-01VQD",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame g5 → h6", "Dame g5 → h4", "Dame g5 → h5", "Dame g5 → d5"],
    correctAnswer: 0,
    explanation: "Une ligne de mat : Dame g5 → h6 ; Dame e2 → h5 ; Dame h6 → h5. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1b2rk1/ppp2p1p/6p1/1N1P2q1/1PPbBp2/6P1/1P2Q1P1/R1B2R1K b - - 0 18",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/01VQD"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["g5h6", "g5h4", "g5h5", "g5d5"],
      principalLine: ["g5h6", "e2h5", "h6h5"],
      puzzleId: "01VQD"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen g5 → h6", "Queen g5 → h4", "Queen g5 → h5", "Queen g5 → d5"],
      explanation: "One mating line: Queen g5 → h6; Queen e2 → h5; Queen h6 → h5. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-01xaX",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Cavalier c6 → a7", "Cavalier c6 → e7", "Pion g3 → f4", "Tour b1 → b8"],
    correctAnswer: 3,
    explanation: "Une ligne de mat : Tour b1 → b8 ; Roi c8 → d7 ; Tour b8 → d8. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 4,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "queensideAttack", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2k2b1r/2p2ppp/p1N1p3/8/q1P2n2/P5P1/5PBP/1R4K1 w - - 0 21",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/01xaX"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["c6a7", "c6e7", "g3f4", "b1b8"],
      principalLine: ["b1b8", "c8d7", "b8d8"],
      puzzleId: "01xaX"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Knight c6 → a7", "Knight c6 → e7", "Pawn g3 → f4", "Rook b1 → b8"],
      explanation: "One mating line: Rook b1 → b8; King c8 → d7; Rook b8 → d8. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-01XlK",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Cavalier e4 → c3", "Cavalier e4 → c5", "Cavalier e4 → g5", "Cavalier e4 → d6"],
    correctAnswer: 2,
    explanation: "Une ligne de mat : Cavalier e4 → g5 ; Roi h7 → h8 ; Dame d3 → h7. Thème : double échec. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "discoveredCheck", "doubleCheck", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r3qr2/2pn3k/p2p1P1b/1p4pp/3PN3/P2Q4/1PP2P2/2K4R w - - 1 23",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/01XlK"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["e4c3", "e4c5", "e4g5", "e4d6"],
      principalLine: ["e4g5", "h7h8", "d3h7"],
      puzzleId: "01XlK"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Knight e4 → c3", "Knight e4 → c5", "Knight e4 → g5", "Knight e4 → d6"],
      explanation: "One mating line: Knight e4 → g5; King h7 → h8; Queen d3 → h7. Theme: double check. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-026wE",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Pion d6 → e5", "Dame h5 → d1", "Dame h5 → h2", "Dame h5 → e5"],
    correctAnswer: 1,
    explanation: "Une ligne de mat : Dame h5 → d1 ; Tour e5 → e1 ; Dame d1 → e1. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "hangingPiece", "kingsideAttack", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "1rbr2k1/ppN2ppp/3p4/4R2q/8/1B4Q1/PPP2PPP/3R2K1 b - - 0 19",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/026wE"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["d6e5", "h5d1", "h5h2", "h5e5"],
      principalLine: ["h5d1", "e5e1", "d1e1"],
      puzzleId: "026wE"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Pawn d6 → e5", "Queen h5 → d1", "Queen h5 → h2", "Queen h5 → e5"],
      explanation: "One mating line: Queen h5 → d1; Rook e5 → e1; Queen d1 → e1. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-02dgL",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame h6 → f8", "Dame h6 → h7", "Dame h6 → g7", "Fou g5 → f6"],
    correctAnswer: 0,
    explanation: "Une ligne de mat : Dame h6 → f8 ; Cavalier d7 → f8 ; Fou g5 → f6. Thème : sacrifice pour ouvrir le réseau de mat. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "doubleBishopMate", "kingsideAttack", "mate", "mateIn2", "middlegame", "sacrifice", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1b2r1k/p2n3p/2p1B1pQ/q2p2B1/4p3/2P5/P1P4P/R3K2R w KQ - 1 21",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/02dgL"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["h6f8", "h6h7", "h6g7", "g5f6"],
      principalLine: ["h6f8", "d7f8", "g5f6"],
      puzzleId: "02dgL"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen h6 → f8", "Queen h6 → h7", "Queen h6 → g7", "Bishop g5 → f6"],
      explanation: "One mating line: Queen h6 → f8; Knight d7 → f8; Bishop g5 → f6. Theme: sacrifice to open the mating net. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-02MvQ",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame h3 → f1", "Dame h3 → g2", "Dame h3 → h1", "Dame h3 → g3"],
    correctAnswer: 3,
    explanation: "Une ligne de mat : Dame h3 → g3 ; Roi g1 → f1 ; Dame g3 → f2. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "kingsideAttack", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2kr3r/pppn1ppp/8/8/3P2n1/5N1q/PPP1BN2/R1BQR1K1 b - - 0 20",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/02MvQ"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["h3f1", "h3g2", "h3h1", "h3g3"],
      principalLine: ["h3g3", "g1f1", "g3f2"],
      puzzleId: "02MvQ"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen h3 → f1", "Queen h3 → g2", "Queen h3 → h1", "Queen h3 → g3"],
      explanation: "One mating line: Queen h3 → g3; King g1 → f1; Queen g3 → f2. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-02Nya",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame e6 → d7", "Dame e6 → e7", "Dame e6 → d6", "Dame e6 → c8"],
    correctAnswer: 2,
    explanation: "Une ligne de mat : Dame e6 → d6 ; Roi d8 → c8 ; Fou f7 → e6. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3k3r/pp3Bb1/2npQ2p/q5p1/5p2/8/PPP2BPP/3N2K1 w - - 0 21",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/02Nya"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["e6d7", "e6e7", "e6d6", "e6c8"],
      principalLine: ["e6d6", "d8c8", "f7e6"],
      puzzleId: "02Nya"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen e6 → d7", "Queen e6 → e7", "Queen e6 → d6", "Queen e6 → c8"],
      explanation: "One mating line: Queen e6 → d6; King d8 → c8; Bishop f7 → e6. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-02QKd",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Tour a1 → a3", "Tour a1 → a8", "Dame d1 → f1", "Tour a1 → a2"],
    correctAnswer: 1,
    explanation: "Une ligne de mat : Tour a1 → a8 ; Tour c5 → c8 ; Tour a8 → c8. Thème : mat du couloir. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "backRankMate", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "6k1/1p1p1ppp/1P2p3/2r5/6n1/7q/1PPPPP1P/R1BQ1nK1 w - - 1 19",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/02QKd"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["a1a3", "a1a8", "d1f1", "a1a2"],
      principalLine: ["a1a8", "c5c8", "a8c8"],
      puzzleId: "02QKd"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Rook a1 → a3", "Rook a1 → a8", "Queen d1 → f1", "Rook a1 → a2"],
      explanation: "One mating line: Rook a1 → a8; Rook c5 → c8; Rook a8 → c8. Theme: back-rank mate. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-02tYt",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Cavalier c5 → e6", "Tour b7 → b8", "Tour c7 → c8", "Tour c7 → d7"],
    correctAnswer: 0,
    explanation: "Une ligne de mat : Cavalier c5 → e6 ; Roi d8 → e8 ; Tour c7 → e7. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 4,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "short", "vukovicMate"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3k4/1RR3pp/2p5/p1N1p2n/P7/1P5P/2nr4/3r1NK1 w - - 7 29",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/02tYt"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["c5e6", "b7b8", "c7c8", "c7d7"],
      principalLine: ["c5e6", "d8e8", "c7e7"],
      puzzleId: "02tYt"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Knight c5 → e6", "Rook b7 → b8", "Rook c7 → c8", "Rook c7 → d7"],
      explanation: "One mating line: Knight c5 → e6; King d8 → e8; Rook c7 → e7. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-02yab",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Fou e3 → f2", "Pion h3 → h2", "Roi f3 → f4", "Roi f3 → g3"],
    correctAnswer: 3,
    explanation: "Une ligne de mat : Roi f3 → g3 ; Tour c2 → c8 ; Pion h3 → h2. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 4,
    tags: ["board", "mate-in-2", "advancedPawn", "endgame", "master", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "8/8/8/8/8/4bk1p/2R2Np1/6K1 b - - 7 62",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/02yab"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["e3f2", "h3h2", "f3f4", "f3g3"],
      principalLine: ["f3g3", "c2c8", "h3h2"],
      puzzleId: "02yab"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Bishop e3 → f2", "Pawn h3 → h2", "King f3 → f4", "King f3 → g3"],
      explanation: "One mating line: King f3 → g3; Rook c2 → c8; Pawn h3 → h2. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-036i1",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Pion b4 → c5", "Pion c3 → d4", "Fou e8 → f7", "Fou e8 → b5"],
    correctAnswer: 2,
    explanation: "Une ligne de mat : Fou e8 → f7 ; Fou f5 → e6 ; Fou f7 → e6. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-2", "bishopEndgame", "endgame", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "4B3/8/1p5p/2p2bp1/PPkp1p2/2P2P1P/3K2P1/8 w - - 1 41",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/036i1"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["b4c5", "c3d4", "e8f7", "e8b5"],
      principalLine: ["e8f7", "f5e6", "f7e6"],
      puzzleId: "036i1"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Pawn b4 → c5", "Pawn c3 → d4", "Bishop e8 → f7", "Bishop e8 → b5"],
      explanation: "One mating line: Bishop e8 → f7; Bishop f5 → e6; Bishop f7 → e6. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-03B3o",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame d3 → a6", "Dame d3 → d8", "Dame d3 → d7", "Dame d3 → f5"],
    correctAnswer: 1,
    explanation: "Une ligne de mat : Dame d3 → d8 ; Tour h8 → d8 ; Tour d1 → d8. Thème : sacrifice pour ouvrir le réseau de mat. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-2", "endgame", "mate", "mateIn2", "queensideAttack", "sacrifice", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2k4r/1p3qp1/p1p2pp1/B3b3/8/3Q3P/P1P2PP1/3R2K1 w - - 1 23",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/03B3o"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["d3a6", "d3d8", "d3d7", "d3f5"],
      principalLine: ["d3d8", "h8d8", "d1d8"],
      puzzleId: "03B3o"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen d3 → a6", "Queen d3 → d8", "Queen d3 → d7", "Queen d3 → f5"],
      explanation: "One mating line: Queen d3 → d8; Rook h8 → d8; Rook d1 → d8. Theme: sacrifice to open the mating net. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-03gHj",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame e6 → h3", "Dame e6 → e1", "Dame e6 → e2", "Dame e6 → c8"],
    correctAnswer: 0,
    explanation: "Une ligne de mat : Dame e6 → h3 ; Roi f1 → g1 ; Tour e8 → e1. Thème : attaque à la découverte. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 4,
    tags: ["board", "mate-in-2", "deflection", "discoveredAttack", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3nr1k1/R5p1/2b1q2p/3p4/3N4/1Q1P2PP/1P3P2/1N2RK2 b - - 0 34",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/03gHj"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["e6h3", "e6e1", "e6e2", "e6c8"],
      principalLine: ["e6h3", "f1g1", "e8e1"],
      puzzleId: "03gHj"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen e6 → h3", "Queen e6 → e1", "Queen e6 → e2", "Queen e6 → c8"],
      explanation: "One mating line: Queen e6 → h3; King f1 → g1; Rook e8 → e1. Theme: discovered attack. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-03haq",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame e2 → h5", "Fou b3 → g8", "Dame e2 → e3", "Tour h1 → h5"],
    correctAnswer: 3,
    explanation: "Une ligne de mat : Tour h1 → h5 ; Pion g6 → h5 ; Dame e2 → h5. Thème : sacrifice pour ouvrir le réseau de mat. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "sacrifice", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r2q1r2/4b1pk/2p3p1/pp4Pp/5P2/PB1Pn3/1PP1Q3/2KR3R w - - 0 22",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/03haq"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["e2h5", "b3g8", "e2e3", "h1h5"],
      principalLine: ["h1h5", "g6h5", "e2h5"],
      puzzleId: "03haq"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen e2 → h5", "Bishop b3 → g8", "Queen e2 → e3", "Rook h1 → h5"],
      explanation: "One mating line: Rook h1 → h5; Pawn g6 → h5; Queen e2 → h5. Theme: sacrifice to open the mating net. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-03ojQ",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Fou c1 → d2", "Fou d5 → a2", "Pion b5 → b4", "Fou c1 → b2"],
    correctAnswer: 2,
    explanation: "Une ligne de mat : Pion b5 → b4 ; Roi c3 → d3 ; Fou d5 → c4. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 4,
    tags: ["board", "mate-in-2", "endgame", "mate", "mateIn2", "morphysMate", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "8/2k4P/2p5/1p1b4/5r2/2K3Q1/P1P2P2/2b5 b - - 0 43",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/03ojQ"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["c1d2", "d5a2", "b5b4", "c1b2"],
      principalLine: ["b5b4", "c3d3", "d5c4"],
      puzzleId: "03ojQ"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Bishop c1 → d2", "Bishop d5 → a2", "Pawn b5 → b4", "Bishop c1 → b2"],
      explanation: "One mating line: Pawn b5 → b4; King c3 → d3; Bishop d5 → c4. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-03pR6",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame e5 → g5", "Tour g3 → h3", "Tour g3 → g6", "Dame e5 → f4"],
    correctAnswer: 1,
    explanation: "Une ligne de mat : Tour g3 → h3 ; Dame f4 → h4 ; Tour h3 → h4. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-2", "endgame", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "5r2/p6p/6pk/4Q3/3Ppq2/6R1/P4PKP/2r5 w - - 3 34",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/03pR6"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["e5g5", "g3h3", "g3g6", "e5f4"],
      principalLine: ["g3h3", "f4h4", "h3h4"],
      puzzleId: "03pR6"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen e5 → g5", "Rook g3 → h3", "Rook g3 → g6", "Queen e5 → f4"],
      explanation: "One mating line: Rook g3 → h3; Queen f4 → h4; Rook h3 → h4. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-03Q08",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Cavalier h3 → g5", "Cavalier h3 → f4", "Tour c7 → e7", "Tour f3 → f6"],
    correctAnswer: 0,
    explanation: "Une ligne de mat : Cavalier h3 → g5 ; Roi e6 → d5 ; Tour f3 → d3. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rn6/2R5/3pk1p1/1r2p2n/1P6/5RPN/5P2/6K1 w - - 2 38",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/03Q08"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["h3g5", "h3f4", "c7e7", "f3f6"],
      principalLine: ["h3g5", "e6d5", "f3d3"],
      puzzleId: "03Q08"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Knight h3 → g5", "Knight h3 → f4", "Rook c7 → e7", "Rook f3 → f6"],
      explanation: "One mating line: Knight h3 → g5; King e6 → d5; Rook f3 → d3. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-03vYY",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Cavalier e7 → g6", "Fou b4 → a3", "Fou b4 → a5", "Fou b4 → c3"],
    correctAnswer: 3,
    explanation: "Une ligne de mat : Fou b4 → c3 ; Fou a7 → d4 ; Fou c3 → d4. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-2", "endgame", "master", "masterVsMaster", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "4r2k/b3N2p/6p1/1p6/1Bb2P2/5P1P/3K2P1/8 w - - 0 38",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/03vYY"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["e7g6", "b4a3", "b4a5", "b4c3"],
      principalLine: ["b4c3", "a7d4", "c3d4"],
      puzzleId: "03vYY"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Knight e7 → g6", "Bishop b4 → a3", "Bishop b4 → a5", "Bishop b4 → c3"],
      explanation: "One mating line: Bishop b4 → c3; Bishop a7 → d4; Bishop c3 → d4. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-03WAB",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame f7 → f3", "Tour g1 → g7", "Tour d7 → a7", "Tour d7 → d8"],
    correctAnswer: 2,
    explanation: "Une ligne de mat : Tour d7 → a7 ; Roi a8 → b8 ; Dame f7 → b7. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 3,
    tags: ["board", "mate-in-2", "endgame", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "k2r1r2/3R1Qpp/p3p3/4q3/1p6/3P4/3K1P1P/6R1 w - - 1 30",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/03WAB"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["f7f3", "g1g7", "d7a7", "d7d8"],
      principalLine: ["d7a7", "a8b8", "f7b7"],
      puzzleId: "03WAB"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen f7 → f3", "Rook g1 → g7", "Rook d7 → a7", "Rook d7 → d8"],
      explanation: "One mating line: Rook d7 → a7; King a8 → b8; Queen f7 → b7. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-03wQ4",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Tour c2 → d2", "Tour c2 → c1", "Dame e4 → e3", "Tour c2 → b2"],
    correctAnswer: 1,
    explanation: "Une ligne de mat : Tour c2 → c1 ; Tour d2 → d1 ; Dame e4 → b4. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 4,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "pin", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2k1r3/7p/1p6/6Q1/4q2P/3pB3/PPrR1P2/4KR2 b - - 4 31",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/03wQ4"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["c2d2", "c2c1", "e4e3", "c2b2"],
      principalLine: ["c2c1", "d2d1", "e4b4"],
      puzzleId: "03wQ4"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Rook c2 → d2", "Rook c2 → c1", "Queen e4 → e3", "Rook c2 → b2"],
      explanation: "One mating line: Rook c2 → c1; Rook d2 → d1; Queen e4 → b4. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-03ySM",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame a6 → c8", "Fou d3 → h7", "Dame a6 → e6", "Tour e1 → e6"],
    correctAnswer: 0,
    explanation: "Une ligne de mat : Dame a6 → c8 ; Fou e6 → c8 ; Tour e1 → e8. Thème : sacrifice pour ouvrir le réseau de mat. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 4,
    tags: ["board", "mate-in-2", "endgame", "mate", "mateIn2", "pillsburysMate", "sacrifice", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "2r3k1/5pp1/Q3b2p/3p4/3q4/3B3P/1P3PP1/4R1K1 w - - 0 27",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/03ySM"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["a6c8", "d3h7", "a6e6", "e1e6"],
      principalLine: ["a6c8", "e6c8", "e1e8"],
      puzzleId: "03ySM"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen a6 → c8", "Bishop d3 → h7", "Queen a6 → e6", "Rook e1 → e6"],
      explanation: "One mating line: Queen a6 → c8; Bishop e6 → c8; Rook e1 → e8. Theme: sacrifice to open the mating net. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-046AR",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame e4 → d4", "Dame e4 → c2", "Dame e4 → d3", "Tour d8 → d4"],
    correctAnswer: 3,
    explanation: "Une ligne de mat : Tour d8 → d4 ; Pion c3 → d4 ; Fou f8 → b4. Thème : sacrifice pour ouvrir le réseau de mat. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 4,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "sacrifice", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "3r1b1r/pp4pk/2p1p2p/5b2/3Pq3/2P2BP1/PP1K3P/R1BQ3R b - - 4 20",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/046AR"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["e4d4", "e4c2", "e4d3", "d8d4"],
      principalLine: ["d8d4", "c3d4", "f8b4"],
      puzzleId: "046AR"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen e4 → d4", "Queen e4 → c2", "Queen e4 → d3", "Rook d8 → d4"],
      explanation: "One mating line: Rook d8 → d4; Pawn c3 → d4; Bishop f8 → b4. Theme: sacrifice to open the mating net. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-04bpR",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame g1 → e3", "Dame g1 → g3", "Dame g1 → g4", "Dame g1 → d4"],
    correctAnswer: 2,
    explanation: "Une ligne de mat : Dame g1 → g4 ; Roi f4 → e3 ; Dame g4 → e4. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 4,
    tags: ["board", "mate-in-2", "endgame", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "8/5pk1/p7/1p1pPp2/5K1P/2P2R2/PP6/3Qb1q1 b - - 0 35",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/04bpR"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["g1e3", "g1g3", "g1g4", "g1d4"],
      principalLine: ["g1g4", "f4e3", "g4e4"],
      puzzleId: "04bpR"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen g1 → e3", "Queen g1 → g3", "Queen g1 → g4", "Queen g1 → d4"],
      explanation: "One mating line: Queen g1 → g4; King f4 → e3; Queen g4 → e4. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-04FYp",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame h6 → f6", "Tour f1 → f8", "Dame h6 → f8", "Dame h6 → h7"],
    correctAnswer: 1,
    explanation: "Une ligne de mat : Tour f1 → f8 ; Dame e7 → f8 ; Dame h6 → h7. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "kingsideAttack", "mate", "mateIn2", "middlegame", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "5r1k/ppp1q2p/2nb3Q/3p4/3P4/2PB4/P1P3PP/5RK1 w - - 0 23",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/04FYp"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["h6f6", "f1f8", "h6f8", "h6h7"],
      principalLine: ["f1f8", "e7f8", "h6h7"],
      puzzleId: "04FYp"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen h6 → f6", "Rook f1 → f8", "Queen h6 → f8", "Queen h6 → h7"],
      explanation: "One mating line: Rook f1 → f8; Queen e7 → f8; Queen h6 → h7. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-04GTt",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Dame g3 → c7", "Tour h8 → e8", "Dame g3 → d6", "Dame g3 → b8"],
    correctAnswer: 0,
    explanation: "Une ligne de mat : Dame g3 → c7 ; Fou e8 → d7 ; Dame c7 → c5. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 4,
    tags: ["board", "mate-in-2", "endgame", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "4b2R/pp2kq2/4pr2/3p4/3P4/2P3QP/PP4P1/6K1 w - - 28 39",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/04GTt"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["g3c7", "h8e8", "g3d6", "g3b8"],
      principalLine: ["g3c7", "e8d7", "c7c5"],
      puzzleId: "04GTt"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Queen g3 → c7", "Rook h8 → e8", "Queen g3 → d6", "Queen g3 → b8"],
      explanation: "One mating line: Queen g3 → c7; Bishop e8 → d7; Queen c7 → c5. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-04LMD",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Cavalier f8 → d7", "Tour c7 → c6", "Tour c7 → f7", "Cavalier f8 → h7"],
    correctAnswer: 3,
    explanation: "Une ligne de mat : Cavalier f8 → h7 ; Roi f6 → f5 ; Tour c7 → c5. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "endgames",
    difficulty: 4,
    tags: ["board", "mate-in-2", "endgame", "fork", "interference", "master", "mate", "mateIn2", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "4RN2/2R5/1r3kpp/2p3q1/2P5/2r3PP/7K/8 w - - 1 40",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/04LMD"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["f8d7", "c7c6", "c7f7", "f8h7"],
      principalLine: ["f8h7", "f6f5", "c7c5"],
      puzzleId: "04LMD"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Knight f8 → d7", "Rook c7 → c6", "Rook c7 → f7", "Knight f8 → h7"],
      explanation: "One mating line: Knight f8 → h7; King f6 → f5; Rook c7 → c5. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-04lPa",
    revision: 1,
    question: "Trait aux Noirs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Cavalier d3 → f2", "Cavalier d3 → b2", "Tour f8 → f1", "Fou b7 → g2"],
    correctAnswer: 2,
    explanation: "Une ligne de mat : Tour f8 → f1 ; Dame d4 → g1 ; Cavalier d3 → f2. Thème : mat à l’étouffée. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "pin", "short", "smotheredMate"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "5rk1/1b1n2pp/p3R3/1p6/3Q4/2Nn4/PPP3PP/7K b - - 0 24",
      showCoordinates: true,
      boardFlipped: true
    },
    sources: ["https://lichess.org/training/04lPa"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["d3f2", "d3b2", "f8f1", "b7g2"],
      principalLine: ["f8f1", "d4g1", "d3f2"],
      puzzleId: "04lPa"
    },
    i18nEn: {
      question: "Black to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Knight d3 → f2", "Knight d3 → b2", "Rook f8 → f1", "Bishop b7 → g2"],
      explanation: "One mating line: Rook f8 → f1; Queen d4 → g1; Knight d3 → f2. Theme: smothered mate. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  },
  {
    id: "position-mate-04Q6b",
    revision: 1,
    question: "Trait aux Blancs. Quel coup force le mat en deux coups au plus, quelle que soit la défense ?",
    answers: ["Tour h7 → h6", "Tour g2 → g6", "Tour g2 → f2", "Tour h7 → f7"],
    correctAnswer: 1,
    explanation: "Une ligne de mat : Tour g2 → g6 ; Roi f6 → e5 ; Tour h7 → h5. Thème : coordination des pièces et contrôle des cases de fuite. Toutes les réponses légales au premier coup ont été vérifiées : le mat suit au plus tard au coup suivant.",
    category: "checkmates",
    difficulty: 3,
    tags: ["board", "mate-in-2", "mate", "mateIn2", "middlegame", "pillsburysMate", "short"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r7/7R/2p2k2/3p4/pp6/qP1Br3/P1P1N1R1/1K6 w - - 0 29",
      showCoordinates: true,
      boardFlipped: false
    },
    sources: ["https://lichess.org/training/04Q6b"],
    verification: {
      kind: "mate",
      movesToMate: 2,
      answerMoves: ["h7h6", "g2g6", "g2f2", "h7f7"],
      principalLine: ["g2g6", "f6e5", "h7h5"],
      puzzleId: "04Q6b"
    },
    i18nEn: {
      question: "White to move. Which move forces checkmate in at most two moves against every defence?",
      answers: ["Rook h7 → h6", "Rook g2 → g6", "Rook g2 → f2", "Rook h7 → f7"],
      explanation: "One mating line: Rook g2 → g6; King f6 → e5; Rook h7 → h5. Theme: piece coordination and control of escape squares. Every legal reply to the first move has been checked; mate follows on the next move at the latest."
    }
  }
];
