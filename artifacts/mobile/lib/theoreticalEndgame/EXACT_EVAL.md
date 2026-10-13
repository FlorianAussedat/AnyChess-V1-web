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
Trois protocoles : mats élémentaires (DTM puis mate-drive) ; gains de pions
(promotion Q/R, sans DTM ni centipions) ; défenses (mécanisme démontré).

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
- **Budget total par tentative** — 25 s, persisté. Une reprise n’obtient
  pas un nouveau plafond. Le jeu revendique le moteur ; une analyse
  incomplète reste reprenable.
- **Budget progressif (mats)** — paliers 400 / 900 / 1600 ms, plus 3000 ms
  au-delà de 10 décisions, dans le plafond de 25 s. Un trou n’arrête pas
  la passe. Un `go depth` ne coupe pas l’annonce de mat. Repli mate-drive
  si Lite n’annonce pas le mat.
- **Trajectoires de référence** — `efficient`, `detour`, `recovered`,
  les deux couleurs. La note publiée des gains de pions et des défenses
  est comparée à une mesure indépendante sur l’échiquier, pas seulement
  à « 7 coups moins bien que 8 ».

Le rapport distingue : parties lancées ; terminées gagnées / perdues ;
interrompues par le plafond ; réussites notées **gagnantes** vs
**défenses** ; taux noté par thème (cible 95 % des réussites, pas des
parties lancées) ; temps de jeu et d’analyse ; causes d’échec. Une perte
0/5 n’est pas une réussite notée. 36 victoires ne prouvent pas la notation
des exercices de nulle.

**Percée.** Une nulle automatisée unique ne tranche pas. Vérification
indépendante : FEN classique légale, `b6`/`bxa5`/`exd5` légaux, lignes de
référence qui promeuvent et matent. Cause observée d’une nulle Lite : le
joueur automatisé à court délai peut jouer `Ke2` (0,00) au lieu de `b6`.
Ce n’est pas une FEN incorrecte. Le sélecteur de percée force `b6` quand
il est légal.

Limites restantes : tables élémentaires locales toujours désactivées
(faux mat en 1) ; Lite peut manquer un `score mate` sur un deux-fous
DTM 33, d’où une note mate-drive estimée plutôt qu’une DTM ; l’autoplay
moteur seul ne suffit pas pour KPK/opposition (lignes enregistrées).
Toute réussite reste comptabilisée même si l’analyse échoue.

Mesure Stockfish 18 Lite WASM, 13 octobre 2026 (PR #98) :

| | |
| --- | --- |
| Parties lancées | 50 |
| Terminées gagnées | 50 (30 gains, 20 défenses) |
| Réussites notées | 50 / 50 (30 gains, 20 défenses) |
| Taux noté par thème | 100 % (cible 95 %) |
| Délai jeu + analyse | ~0,4 s + 32–54 s |
| Gains de pions / défenses | instantanés (sans moteur) |
| Deux fous catalogue DTM 33, palier 400 ms seul | 11,8 s, aucune note |
| Deux fous catalogue, 5 s puis mate-drive | ~5,2 s, note estimée 3,5 et 2 |
| Dame | 5 vs 4,5 (DTM) |
| Tour catalogue | 4 vs 2,5 (DTM : 8 coups mieux que 7) |
| Lucena | 4,5 vs 3,5 (progression, pas DTM) |
| Percée Lite 200 ms | `Kd2`/`Ke2` (0,00), pas `b6` ; lignes de référence : 3 mats + 1 promotion |

Le mate-drive des deux fous longs est une note estimée d’efficacité de réalisation, pas une DTM. Lite à 200 ms manque `b6` : ce n’est pas une FEN fausse.
