# Évaluation exacte locale — étude, pas d’intégration

La DTM Syzygy du catalogue ne couvre que le FEN initial. Une note de parcours
exige la distance de chaque position rencontrée. Cette étude mesure des tables
rétrogrades **de cette implémentation**, avant toute lecture pendant le jeu.

Les tables **ne sont pas utilisées** (`ENABLED` est vide). Ce n’est pas une
preuve qu’une évaluation exacte locale est impossible : c’est cette
construction, avec ses défauts, qui inventerait des notes.

## Couverture, taille, coût

Mesure Node, `studyElementaryTables()`, 2026-10-13 :

| Famille | Positions | Octets | Construction | max DTM stocké | Activée |
| --- | ---: | ---: | ---: | ---: | --- |
| KQK | 524 288 | 524 288 | ~317 ms | 10 | non |
| KRK | 524 288 | 524 288 | ~471 ms | 25 | non |
| KPK | 393 216 | 393 216 | ~92 ms | 38 | non |
| KBBK | 8 388 608 | 8 388 608 | non construite | — | non |

KQK : 512 Ko et ~300 ms. **Faisable** sur l’appareil si le graphe d’unmoves
est correct. Le désactiver ne dit pas que KQK exact est hors de portée.

KBBK (deux fous) : 64×64×32×32×2, 8 Mo. C’est une contrainte de **taille et
de temps** sur le fil de l’application, pas une impossibilité théorique. Une
table vérifiée, précalculée, ou Syzygy embarquée resterait exacte. Tant
qu’elle n’est pas là, les deux fous passent par le moteur (note estimée).

`chess.js` n’est pas assez rapide pour un rétrograde (environ 0,21 ms par
position). Le constructeur évite donc cette bibliothèque. Ce choix n’est pas
non plus une preuve d’impossibilité : un générateur de coups spécialisé
suffirait.

## Défauts de CE rétrograde (pas de l’idée)

Contrôles avec `includeDisabled = true`. `exactUserDtm` reste `null` tant
que `ENABLED` est vide.

1. **Faux mat en un.** `k7/8/8/8/8/8/8/K6Q w` n’est pas un mat en un coup
   (le roi noir a des fuites). La table renvoie **1**. Cause probable :
   génération d’unmoves incomplète / parents blancs poussés dès qu’un coup
   inverse existe, sans vérifier que le camp au trait n’a plus d’évasion.
2. **Plafond KQK trop bas.** Le maximum stocké est 10. KQK théorique va
   environ à 19 plies. Même un FEN catalogue dont la vraie distance est 13
   ne peut pas être représenté si la cellule n’est jamais labellisée, ou
   l’est trop tôt. Une table correcte de 512 Ko n’a pas cette limite.
3. **KPK catalogue sans distance.** `8/8/8/4k3/8/3K4/4P3/8 w` (gain
   catalogue) reste `null`. Les promotions ne sont pas reliées proprement à
   KQK, et les unmoves de pion (simple, double, prise) sont incomplets.
4. **Unmoves incomplets.** Les coups blancs inverses ne rejouent pas la
   légalité du parent (échec découvert, pièce qui saute, roi adjacent). Les
   compteurs `remaining` du camp noir ne redescendent alors pas, d’où des
   gains jamais marqués et des mats trop courts.

Une note tirée de ces distances serait arbitraire. Cela **n’interdit pas**
une DTM locale exacte : il faudrait un graphe vérifié (tests de mat en 1
connus, max DTM KQK ~19, FEN catalogue KPK et KQK alignés sur Syzygy), puis
seulement activer `ENABLED`.

## Autres finales

Les thèmes hors de ces familles n’ont pas de table locale. Après la partie,
une analyse moteur **progressive et bornée** (trous reprenés à un budget
plus élevé, curseur et budget enregistrés) produit une **note estimée**
quand un mat est annoncé sur tout le chemin. Les moyennes exactes et
estimées restent séparées. Un score en centipions n’est jamais converti.
Les défenses sont notées par le mécanisme démontré, pas par `score mate`.

Voir `SCORING.md` pour l’enregistrement immédiat, le budget progressif et
les trajectoires enregistrées.

## Vérification moteur (Stockfish 18 Lite WASM)

Parcours réel, pas un analyseur simulé : victoire enregistrée sans note,
note calculée après la partie, fermeture puis reprise du curseur, autre
finale lancée pendant l’analyse, pas de double comptage, réussite sans note
hors moyenne et dans les tentatives.

Protocoles de mesure :

- **Parties automatisées** — plafond adapté (36 coups utilisateur pour les
  deux fous, DTM 33). Les défenses choisissent un coup légal qui complète
  le mécanisme, pas le meilleur coup moteur des deux camps.
- **Trajectoires enregistrées** — réalisations complètes, niveaux
  `efficient` et `detour`. Une note plus nombreuse n’est pas un succès si
  elle ne sépare pas le détour.
- **Budget progressif** — paliers 400 / 900 / 1600 ms, uniquement sur les
  trous. Un `go depth` ne coupe pas l’annonce de mat.

Le rapport distingue : parties lancées ; terminées gagnées / perdues ;
interrompues par le plafond ; réussites effectivement notées ; temps de
jeu et d’analyse ; causes d’échec. Une perte 0/5 n’est pas une réussite
notée.

Mesure Stockfish 18 Lite WASM, 13 octobre 2026 (suite de #97) :

| | |
| --- | --- |
| Parties lancées | 35 |
| Terminées gagnées | 33 |
| Terminées perdues | 2 |
| Interrompues par le plafond | 0 |
| Réussites effectivement notées | 23 |
| Deux fous (lancées / gagnées / notées) | 5 / 5 / 2 |
| Notes deux fous | 5 (efficace) et 3,5 (détours) |
| Dame | 5 vs 4,5 |
| Philidor, Vancura | 4 notées chacune, 5 vs 4,5 |
| Mauvais fou, échecs latéraux, carré, pion de tour | ≥ 2 notées |

Les trois FEN catalogue des deux fous vont au mat avec le plafond 36
(un plafond 20 les arrêtait). Leur note catalogue reste souvent vide :
un `score mate` sur ~17 décisions dépasse encore un budget court. Les
réussites notées de ce thème viennent de trajectoires enregistrées où le
moteur annonce le mat à chaque coup. Ce n’est pas une note inventée.
