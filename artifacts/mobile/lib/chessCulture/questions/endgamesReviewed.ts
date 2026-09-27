/**
 * Canonical Culture générale questions: factual or vocabulary endgames only.
 * Practical method / plan questions were removed from this module.
 */
import type { ChessCultureQuestion } from '../types.ts';

export const QUESTIONS: ChessCultureQuestion[] = [
  {
    id: "endgames-review-003",
    revision: 1,
    question: "Que sont les cases clés d’un pion dans une finale élémentaire ?",
    answers: ["Les cases de départ des tours", "Des cases dont l’occupation par le roi assure la promotion avec un jeu correct, dans la configuration étudiée", "Toutes les cases attaquées par le pion", "Les quatre cases centrales uniquement"],
    correctAnswer: 1,
    explanation: "Les cases clés dépendent de la position du pion et du type de finale ; les pions de tour demandent un traitement particulier.",
    category: "endgames",
    difficulty: 3,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-004",
    revision: 1,
    question: "À quoi sert la règle du carré ?",
    answers: ["Estimer si un roi peut rattraper un pion passé sans autre intervention", "Compter les coups nécessaires au mat avec deux fous", "Déterminer quel fou est mauvais", "Calculer le nombre de promotions possibles"],
    correctAnswer: 0,
    explanation: "Il faut tenir compte du trait et du double pas éventuel du pion depuis sa case de départ.",
    category: "endgames",
    difficulty: 2,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-010",
    revision: 1,
    question: "Qu’est-ce qu’un débordement du roi ?",
    answers: ["Un échec donné simultanément par deux rois", "Un échange de rois contre des pions", "Un détour permettant de pénétrer malgré l’opposition adverse", "Un déplacement du roi hors de l’échiquier"],
    correctAnswer: 2,
    explanation: "Le roi combine menace de pénétration d’un côté et manœuvre de l’autre.",
    category: "endgames",
    difficulty: 3,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-011",
    revision: 1,
    question: "Quelle idée rend célèbre l’étude de Réti de 1921 avec deux pions passés ?",
    answers: ["Deux cavaliers forcent le mat contre roi nu", "Le roi poursuit deux objectifs à la fois grâce à un trajet diagonal", "Une dame est sacrifiée pour le pat", "Un fou change de diagonale après promotion"],
    correctAnswer: 1,
    explanation: "Le roi rapproche simultanément la menace de soutenir son pion et celle de rattraper le pion adverse.",
    category: "endgames",
    difficulty: 4,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-013",
    revision: 1,
    question: "Dans une finale de pions, qu’est-ce qu’une percée ?",
    answers: ["Une invasion de tour en septième", "Un échange volontaire des rois", "Une promotion sans atteindre la dernière rangée", "Un sacrifice ou une poussée qui crée un pion passé décisif"],
    correctAnswer: 3,
    explanation: "Des pions peuvent se sacrifier pour détourner les bloqueurs d’un pion qui passe.",
    category: "endgames",
    difficulty: 3,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-017",
    revision: 1,
    question: "Que signifie « fou de mauvaise couleur » dans la finale fou et pion de tour ?",
    answers: ["Le fou est de couleur opposée au roi", "Le fou se trouve derrière son pion", "Le fou est attaqué par le roi", "Le fou ne contrôle pas la case de promotion du pion"],
    correctAnswer: 3,
    explanation: "Le défaut de contrôle du coin explique la ressource de nulle classique.",
    category: "endgames",
    difficulty: 3,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-021",
    revision: 1,
    question: "Quel matériel permet de forcer le mat contre un roi seul, avec une bonne coordination ?",
    answers: ["Roi et un fou", "Roi et un cavalier", "Roi et deux cavaliers dans toutes les positions", "Roi, fou et cavalier"],
    correctAnswer: 3,
    explanation: "Fou et cavalier peuvent forcer le mat ; deux cavaliers seuls ne peuvent pas le forcer contre une défense correcte en général.",
    category: "endgames",
    difficulty: 3,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-022",
    revision: 1,
    question: "Dans le mat fou et cavalier, vers quel coin conduit-on finalement le roi ?",
    answers: ["N’importe quel coin sans distinction", "Le coin le plus proche du cavalier uniquement", "Un coin de la couleur du fou", "Un coin de couleur opposée au fou"],
    correctAnswer: 2,
    explanation: "Le fou doit contrôler le coin où le réseau final de mat sera construit.",
    category: "endgames",
    difficulty: 4,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-026",
    revision: 1,
    question: "Que signifie « couper le roi » avec une tour ?",
    answers: ["L’obliger à capturer sa propre pièce", "Échanger les tours avec échec", "Lui interdire le franchissement d’une rangée ou d’une colonne", "Le mettre obligatoirement en échec"],
    correctAnswer: 2,
    explanation: "La barrière créée par la tour éloigne le roi d’un pion ou d’un secteur important.",
    category: "endgames",
    difficulty: 3,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-051",
    revision: 1,
    question: "Pourquoi « matériel insuffisant pour forcer le mat » et « position morte » ne sont-ils pas synonymes ?",
    answers: ["Les positions mortes n’existent qu’en blitz", "Une position morte exclut tout mat par une suite légale, même avec coopération", "Une position morte exige des dames", "Tout matériel incapable de forcer le mat produit une nulle automatique"],
    correctAnswer: 1,
    explanation: "Deux cavaliers contre roi illustrent la différence : le mat est possible, mais généralement non forçable.",
    category: "endgames",
    difficulty: 3,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-052",
    revision: 1,
    question: "Quelle finale est nécessairement morte avec seulement les pièces indiquées ?",
    answers: ["Roi et fou contre roi", "Roi et tour contre roi", "Roi et deux fous de couleurs différentes contre roi", "Roi, fou et cavalier contre roi"],
    correctAnswer: 0,
    explanation: "Un seul fou ne permet aucun mat contre un roi nu, même avec coopération.",
    category: "endgames",
    difficulty: 2,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-056",
    revision: 1,
    question: "Que sont les cases correspondantes en finale de pions ?",
    answers: ["Des couples de cases liés par des obligations de réponse pour conserver le résultat", "Les cases de même couleur sur les deux ailes", "Les cases de départ de pièces identiques", "Les cases touchées par deux pions du même camp"],
    correctAnswer: 0,
    explanation: "Leur étude généralise les problèmes d’opposition et de zugzwang à des géométries plus complexes.",
    category: "endgames",
    difficulty: 4,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  },
  {
    id: "endgames-review-059",
    revision: 1,
    question: "Qu’est-ce que la position de Vancura concerne principalement ?",
    answers: ["Un sacrifice de dame contre deux fous", "Une méthode de nulle en tour contre tour et pion de tour", "Un mat forcé avec deux cavaliers", "Une percée de trois pions centraux"],
    correctAnswer: 1,
    explanation: "La défense combine pression latérale sur le pion de tour et échecs lorsque le roi s’en approche.",
    category: "endgames",
    difficulty: 4,
    tags: ["endgames", "reviewed-2026"],
    sourceType: "stable-fact",
    active: true
  }
];
