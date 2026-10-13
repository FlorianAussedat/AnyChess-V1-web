# Évaluation exacte locale — étude, pas d’intégration

La DTM Syzygy du catalogue ne couvre que le FEN initial. Une note de parcours
exige la distance de chaque position rencontrée. Cette étude mesure des tables
rétrogrades en mémoire pour les mats élémentaires, **avant** toute lecture
pendant le jeu.

Les tables **ne sont pas utilisées** (`ENABLED` est vide). Un FEN initial
correct ne suffit pas : une cellule fausse plus loin inventerait une note.

## Couverture, taille, coût

Mesure Node, `studyElementaryTables()`, 2026-10-13 :

| Famille | Positions | Octets | Construction | max DTM stocké | Activée |
| --- | ---: | ---: | ---: | ---: | --- |
| KQK | 524 288 | 524 288 | ~317 ms | 10 | non |
| KRK | 524 288 | 524 288 | ~471 ms | 25 | non |
| KPK | 393 216 | 393 216 | ~92 ms | 38 | non |
| KBBK | 8 388 608 | 8 388 608 | non construite | — | non |

KBBK (deux fous) : 64×64×32×32×2. Trop grande et trop lente pour le fil de
l’application. Les 18 thèmes, y compris les deux fous, passent par le moteur.

`chess.js` n’est pas assez rapide pour un rétrograde (environ 0,21 ms par
position, plus de 4 s pour 20 000 nœuds). Le constructeur évite donc cette
bibliothèque.

## Contrôles qui interdisent l’intégration

- `k7/8/8/8/8/8/8/K6Q w` n’est pas un mat en un coup. La table, si elle est
  lue, renvoie 1.
- Le FEN catalogue dame `8/8/8/4k3/8/8/8/4K2Q w` a une distance réelle de
  7 plies (BFS confirmé). La table peut renvoyer 7, mais le maximum stocké
  (10) est trop bas pour KQK (environ 19 plies).
- Le FEN catalogue KPK gagnant `8/8/8/4k3/8/3K4/4P3/8 w` n’a pas de distance
  dans la table.

Une note tirée de ces distances serait arbitraire. `exactUserDtm` renvoie
donc `null` tant que `ENABLED` est vide.

## Autres finales

Les thèmes hors de ces familles n’ont pas de table locale. Après la partie,
une analyse moteur homogène (même `movetime`, délai borné) produit une **note
estimée**. Les moyennes exactes et estimées restent séparées. Un score en
centipions n’est jamais converti.

Voir `SCORING.md` pour l’enregistrement immédiat et le calcul différé.

## Vérification moteur (Stockfish 18 Lite WASM)

Parcours réel, pas un analyseur simulé : victoire enregistrée sans note, note
calculée après la partie, fermeture puis reprise du curseur, autre finale
lancée pendant l’analyse, pas de double comptage, réussite sans note hors
moyenne et dans les tentatives.

Parties automatisées, 18 thèmes, un FEN catalogue chacun. Jeu : profondeur 12
et 250 ms (20 coups utilisateur pour les deux fous). Note : `movetime` seul,
600–800 ms, sans plafond de profondeur — un `go depth 14` coupe souvent avant
l’annonce de mat.

Mesure du 13 octobre 2026 :

| | |
| --- | --- |
| Thèmes | 18 |
| Parties terminées | 4 |
| Tentatives notées | 2 |
| Proportion notée / terminée | 50 % |

Causes des notes indisponibles :

- **`game-not-finished`** — le plafond de coups (12, 20 pour les deux fous)
  n’atteint pas le mat ni une nulle réglementaire. C’est le cas des deux fous
  (`TE-CANON-TWO-BISHOPS-MATE`, 20 coups utilisateur) et de la plupart des
  thèmes de pions, tours et défense.
- **`engine-no-mate`** — la partie est finie, mais une décision n’a pas reçu
  de `score mate` dans le budget (pion de tour, percée). Les centipions ne
  deviennent pas une note.

Les deux fous n’ont pas de table locale (8 Mo, non construite). Leur note, une
fois le mat atteint, reste **estimée**.
