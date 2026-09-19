/**
 * Canonical Culture générale questions. Generated from the 500-question dossier.
 * Do not hand-edit entries; change the source bank instead.
 */
import type { ChessCultureQuestion } from '../types.ts';

export const QUESTIONS: ChessCultureQuestion[] = [
  {
    id: "opening-board-001",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Dragon accéléré", "Dragon classique", "Sicilienne Najdorf", "Sicilienne Scheveningue"],
    correctAnswer: 0,
    explanation: "Le fianchetto est préparé sans …d6, ce qui distingue cet ordre de coups du Dragon classique.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/pp1ppp1p/2n3p1/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "g6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-002",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Dragon accéléré", "Sicilienne Sveshnikov", "Sicilienne Taimanov", "Dragon classique"],
    correctAnswer: 3,
    explanation: "Les Noirs ont joué …d6 et …Cf6 avant …g6.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-003",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne Sveshnikov", "Sicilienne Kalachnikov", "Sicilienne Najdorf", "Sicilienne Dragon"],
    correctAnswer: 2,
    explanation: "Le coup …a6 après ce développement constitue la signature de la Najdorf.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-004",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne Alapine", "Sicilienne Scheveningue", "Sicilienne Dragon", "Sicilienne Rossolimo"],
    correctAnswer: 1,
    explanation: "Les pions noirs en d6 et e6 forment le petit centre de la Scheveningue.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-005",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne Sveshnikov", "Sicilienne Kalachnikov", "Sicilienne Kan", "Sicilienne Dragon"],
    correctAnswer: 0,
    explanation: "Les Noirs jouent …e5 après avoir développé le cavalier en f6.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkb1r/pp1p1ppp/2n2n2/4p3/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-006",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne Sveshnikov", "Sicilienne Najdorf", "Sicilienne Kan", "Sicilienne Kalachnikov"],
    correctAnswer: 3,
    explanation: "Ici …e5 arrive avant le développement du cavalier g8 en f6.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/pp1p1ppp/2n5/4p3/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "e5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-007",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne Sveshnikov", "Sicilienne Kalachnikov", "Sicilienne Kan", "Sicilienne Dragon"],
    correctAnswer: 2,
    explanation: "Le dispositif …e6 et …a6 garde le cavalier b8 flexible.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/1p1p1ppp/p3p3/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "a6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-008",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne Alapine", "Sicilienne Taimanov", "Sicilienne Najdorf", "Sicilienne Dragon"],
    correctAnswer: 1,
    explanation: "Les Noirs combinent …e6 et …Cc6 sans avoir fixé leur pion d.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/pp1p1ppp/2n1p3/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "Nc6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-009",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne Rossolimo", "Sicilienne de Moscou", "Sicilienne Alapine", "Attaque Grand Prix"],
    correctAnswer: 0,
    explanation: "Le fou se développe en b5 face au cavalier c6, sans donner échec.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/pp1ppppp/2n5/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "Nc6", "Bb5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-010",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne Rossolimo", "Sicilienne fermée", "Gambit Morra", "Sicilienne de Moscou"],
    correctAnswer: 3,
    explanation: "Après …d6, Fb5 donne échec : c’est la variante de Moscou.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/pp2pppp/3p4/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "d6", "Bb5+"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-011",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Attaque Grand Prix", "Gambit Morra", "Sicilienne Alapine", "Sicilienne fermée"],
    correctAnswer: 2,
    explanation: "Le coup c3 prépare d4 avec une possible reprise du pion c.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/2P5/PP1P1PPP/RNBQKBNR b KQkq - 0 2",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "c3"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-012",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne de Moscou", "Gambit Morra", "Sicilienne Alapine", "Gambit de l’aile"],
    correctAnswer: 1,
    explanation: "Les Blancs offrent un pion central pour accélérer leur développement.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/pp1ppppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR b KQkq - 0 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "d4", "cxd4", "c3"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-013",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Attaque Grand Prix", "Sicilienne Alapine", "Gambit Morra", "Sicilienne de Moscou"],
    correctAnswer: 0,
    explanation: "Le dispositif avec Cc3 et f4 vise un jeu actif à l’aile roi.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/pp1ppppp/2n5/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nc3", "Nc6", "f4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-014",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne ouverte", "Sicilienne Alapine", "Sicilienne Rossolimo", "Sicilienne fermée"],
    correctAnswer: 3,
    explanation: "Les Blancs préparent le fianchetto sans ouvrir immédiatement le centre par d4.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N3P1/PPPP1P1P/R1BQKBNR b KQkq - 0 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nc3", "Nc6", "g3"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-015",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Sicilienne Rossolimo", "Sicilienne Sveshnikov", "Étau de Maroczy contre le Dragon accéléré", "Attaque yougoslave du Dragon"],
    correctAnswer: 2,
    explanation: "Les pions c4 et e4 contrôlent d5 et restreignent la rupture noire.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/pp1ppp1p/2n3p1/8/2PNP3/8/PP3PPP/RNBQKB1R b KQkq - 0 5",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "g6", "c4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-016",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Française Rubinstein", "Française Winawer", "Française Tarrasch", "Française d’avance"],
    correctAnswer: 1,
    explanation: "Le fou b4 met le cavalier c3 sous pression dans la variante Winawer.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 2 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e6", "d4", "d5", "Nc3", "Bb4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-017",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Française Tarrasch", "Française Winawer", "Française d’échange", "Française classique avec Cc3 et …Cf6"],
    correctAnswer: 0,
    explanation: "Le développement du cavalier en d2 évite le clouage de la Winawer.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR b KQkq - 1 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e6", "d4", "d5", "Nd2"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-018",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Française d’échange", "Française Rubinstein", "Française Tarrasch", "Française d’avance"],
    correctAnswer: 3,
    explanation: "Le pion e5 fixe la chaîne centrale blanche et gagne de l’espace.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e6", "d4", "d5", "e5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-019",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Française Winawer", "Française Tarrasch", "Française d’échange", "Française d’avance"],
    correctAnswer: 2,
    explanation: "La reprise …exd5 crée une structure centrale symétrique.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/ppp2ppp/8/3p4/3P4/8/PPP2PPP/RNBQKBNR w KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e6", "d4", "d5", "exd5", "exd5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-020",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Française Tarrasch", "Française Rubinstein", "Française Winawer", "Française d’avance"],
    correctAnswer: 1,
    explanation: "Les Noirs abandonnent leur pion d5 contre le pion e4 et développent autour du centre simplifié.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/ppp2ppp/4p3/8/3PN3/8/PPP2PPP/R1BQKBNR b KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e6", "d4", "d5", "Nc3", "dxe4", "Nxe4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-021",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Attaque Panov contre la Caro-Kann", "Caro-Kann d’avance", "Caro-Kann classique", "Variante des Deux Cavaliers contre la Caro-Kann"],
    correctAnswer: 0,
    explanation: "Le coup c4 conteste d5 et peut conduire à un pion dame isolé.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/pp2pppp/8/3p4/2PP4/8/PP3PPP/RNBQKBNR b KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c6", "d4", "d5", "exd5", "cxd5", "c4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-022",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Caro-Kann d’échange", "Attaque Panov", "Caro-Kann des Deux Cavaliers", "Caro-Kann d’avance"],
    correctAnswer: 3,
    explanation: "Le pion e5 avance et le fou c8 sort avant …e6.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/8/PPP2PPP/RNBQKBNR w KQkq - 1 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c6", "d4", "d5", "e5", "Bf5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-023",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Attaque Panov", "Caro-Kann d’échange", "Caro-Kann classique", "Caro-Kann d’avance"],
    correctAnswer: 2,
    explanation: "Après l’échange central, …Ff5 attaque le cavalier e4.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 1 5",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-024",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Gambit Marshall", "Espagnole ouverte", "Espagnole d’échange", "Défense berlinoise avec …Cf6 au troisième coup"],
    correctAnswer: 1,
    explanation: "Les Noirs capturent le pion e4 avec leur cavalier après le roque blanc.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkb1r/1ppp1ppp/p1n5/4p3/B3n3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 6",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Nxe4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-025",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense berlinoise", "Défense Steinitz de l’Espagnole", "Défense Schliemann", "Variante d’échange de l’Espagnole"],
    correctAnswer: 0,
    explanation: "Le développement …Cf6 attaque directement e4 sans jouer …a6 auparavant.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-026",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Espagnole ouverte", "Défense Schliemann", "Gambit Marshall", "Espagnole d’échange"],
    correctAnswer: 3,
    explanation: "Les Blancs échangent leur fou contre le cavalier c6 dès l’ouverture.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-027",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Gambit écossais", "Gambit danois", "Gambit Evans", "Gambit du roi"],
    correctAnswer: 2,
    explanation: "Le pion b4 attaque le fou c5 et est offert pour gagner des temps de développement.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-028",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense russe", "Défense des Deux Cavaliers", "Giuoco Piano avec …Fc5", "Défense Philidor"],
    correctAnswer: 1,
    explanation: "Les Noirs développent leurs deux cavaliers et attaquent le pion e4.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-029",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Partie écossaise", "Partie viennoise", "Défense russe", "Gambit du roi"],
    correctAnswer: 0,
    explanation: "Les Blancs ouvrent le centre par d4 puis reprennent avec le cavalier.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-030",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense Philidor", "Partie écossaise", "Partie viennoise", "Défense russe, ou Petroff"],
    correctAnswer: 3,
    explanation: "Au lieu de défendre e5 immédiatement, les Noirs attaquent e4 avec …Cf6.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "Nf3", "Nf6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-031",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Gambit danois", "Gambit écossais", "Gambit du roi", "Gambit Evans"],
    correctAnswer: 2,
    explanation: "Le pion f est offert pour contester e5 et ouvrir des lignes.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq - 0 2",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "f4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-032",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Début du fou", "Partie viennoise", "Défense russe", "Partie écossaise"],
    correctAnswer: 1,
    explanation: "Le cavalier b1 se développe en c3 avant le cavalier g1.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "Nc3"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-033",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense Nimzo-Indienne", "Défense ouest-indienne", "Défense Grünfeld", "Défense est-indienne"],
    correctAnswer: 0,
    explanation: "Le fou b4 exerce un clouage sur le cavalier c3 et lutte pour e4.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-034",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense Nimzo-Indienne", "Défense est-indienne", "Défense Benoni moderne", "Défense ouest-indienne"],
    correctAnswer: 3,
    explanation: "Le fianchetto du fou c8 est préparé par …b6.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-035",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense ouest-indienne", "Défense Benoni", "Défense Grünfeld", "Défense est-indienne"],
    correctAnswer: 2,
    explanation: "Les Noirs contestent immédiatement le centre par …d5.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-036",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense ouest-indienne", "Défense est-indienne", "Défense Grünfeld", "Défense Nimzo-Indienne"],
    correctAnswer: 1,
    explanation: "Les Noirs laissent le centre blanc se former et préparent une contre-attaque.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-037",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense slave", "Gambit dame refusé avec …e6", "Gambit dame accepté", "Contre-gambit Albin"],
    correctAnswer: 0,
    explanation: "Le pion c6 soutient d5 sans fermer immédiatement la diagonale du fou c8.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "d5", "c4", "c6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-038",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense slave", "Défense Tchigorine", "Contre-gambit Albin", "Gambit dame accepté"],
    correctAnswer: 3,
    explanation: "Les Noirs prennent le pion c4 ; le maintien de ce pion n’est pas leur seule priorité.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "d5", "c4", "dxc4"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-039",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense slave", "Défense Tarrasch", "Contre-gambit Albin", "Gambit dame accepté"],
    correctAnswer: 2,
    explanation: "Les Noirs répondent au gambit par leur propre offre centrale avec …e5.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/ppp2ppp/8/3pp3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "d5", "c4", "e5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-040",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense Grünfeld", "Gambit Benko", "Benoni moderne sans …b5", "Gambit de Budapest"],
    correctAnswer: 1,
    explanation: "Le pion b5 est offert pour obtenir des colonnes et de la pression à l’aile dame.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "Nf6", "c4", "c5", "d5", "b5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-041",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Benoni moderne", "Gambit Benko", "Défense est-indienne", "Défense slave"],
    correctAnswer: 0,
    explanation: "La structure associe le pion blanc d5 aux pions noirs c5 et d6.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/pp3ppp/3p1n2/2pP4/8/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 6",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "Nf6", "c4", "c5", "d5", "e6", "Nc3", "exd5", "cxd5", "d6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-042",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense Benoni", "Défense Grünfeld", "Défense slave", "Défense hollandaise"],
    correctAnswer: 3,
    explanation: "Le pion f5 contrôle e4 tout en modifiant la sécurité du roi noir.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "f5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-043",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Contre-gambit Albin", "Gambit dame accepté", "Gambit de Budapest", "Gambit Benko"],
    correctAnswer: 2,
    explanation: "L’offre …e5 est jouée alors que le pion noir d est encore en d7.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/pppp1ppp/5n2/4p3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "Nf6", "c4", "e5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-044",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense scandinave", "Défense Alekhine", "Défense Pirc", "Défense moderne"],
    correctAnswer: 1,
    explanation: "Les Noirs provoquent l’avance centrale blanche en faisant manœuvrer leur cavalier.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/ppp1pppp/3p4/3nP3/3P4/8/PPP2PPP/RNBQKBNR w KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "Nf6", "e5", "Nd5", "d4", "d6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-045",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense Pirc", "Défense Alekhine", "Défense Philidor", "Défense française"],
    correctAnswer: 0,
    explanation: "Le dispositif combine …d6, …Cf6 et le fianchetto en préparation.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-046",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense Alekhine", "Défense Pirc", "Défense russe", "Défense scandinave avec …Da5"],
    correctAnswer: 3,
    explanation: "La dame a repris en d5 puis reculé en a5 après l’attaque du cavalier.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnb1kbnr/ppp1pppp/8/q7/8/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-047",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense Nimzo-Indienne", "Gambit dame accepté", "Défense Tarrasch du gambit dame", "Défense slave"],
    correctAnswer: 2,
    explanation: "La rupture précoce …c5 conteste le centre et peut conduire à un pion dame isolé noir.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "rnbqkbnr/pp3ppp/4p3/2pp4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "d5", "c4", "e6", "Nc3", "c5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-048",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Contre-gambit Albin", "Défense Tchigorine", "Défense Tarrasch", "Défense slave"],
    correctAnswer: 1,
    explanation: "Les Noirs privilégient le développement du cavalier b8 plutôt que le soutien immédiat par un pion.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/ppp1pppp/2n5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 1 3",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["d4", "d5", "c4", "Nc6"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-049",
    revision: 1,
    question: "Trait aux Blancs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Défense Schliemann, ou Jaenisch", "Défense berlinoise", "Défense Steinitz", "Variante d’échange"],
    correctAnswer: 0,
    explanation: "La poussée …f5 est un contre-gambit agressif contre l’Espagnole.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqkbnr/pppp2pp/2n5/1B2pp2/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "f5"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  },
  {
    id: "opening-board-050",
    revision: 1,
    question: "Trait aux Noirs. Quelle ouverture ou variante reconnais-tu dans cette position ?",
    answers: ["Gambit Evans", "Partie écossaise", "Gambit du roi", "Giuoco Pianissimo"],
    correctAnswer: 3,
    explanation: "Le centre est préparé avec c3 et d3, dans une version calme de l’Italienne.",
    category: "openings",
    difficulty: 3,
    tags: ["opening-recognition", "board"],
    sourceType: "stable-fact",
    active: true,
    presentation: {
      boardFen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R b KQkq - 0 5",
      showCoordinates: true,
      boardFlipped: false
    },
    verification: {
      kind: "opening",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3"]
    },
    sources: ["https://github.com/lichess-org/chess-openings"]
  }
];
