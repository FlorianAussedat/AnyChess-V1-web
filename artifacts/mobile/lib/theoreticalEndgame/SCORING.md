# Finales théoriques — barème et fins de partie

## Unité

Un **coup** est un coup de l’utilisateur, depuis son camp. Ce n’est ni un demi-coup (ply) ni un coup complet (Blancs + Noirs). Le temps et l’ancienne cible de coups ne sont pas des entrées de la note.

## Échelle `quality-5` (`theoretical-quality-v1`)

| Note | Sens |
| --- | --- |
| 0 | Objectif échoué. |
| 1 à 5, par demi-points | Objectif atteint. 0 n’est jamais une réussite. |
| pas de note | Abandon, interruption technique, ou qualité non évaluée. |

L’abandon et la suspension ne produisent pas un 0. Le plafond technique de 80 coups utilisateur arrête une session qui ne se termine pas ; il n’est pas affiché comme cible et la note reste vide (`interrupted`).

### Mesure

La note d’un gain ne compare pas le nombre de coups à `ceil(DTM initiale / 2)`. Cette formule ne fait que remplacer une cible fixe par la distance du départ. Chaque décision est la position réellement rencontrée, avant le coup, et la position juste après le coup, avant la réponse adverse.

`plies perdus = max(0, dtmAprès − (dtmAvant − 1))`. `extra = ceil(somme / 2)`, plus 4 par perte temporaire du résultat ensuite récupérée, si cette trace de résultat est complète. Une réponse qui raccourcit le mat change seulement le `dtmAvant` suivant. Elle n’efface pas les temps déjà perdus. Garder la même distance est déjà un détour : ce n’est pas un 5.

Deux origines de distance, jamais une conversion de centipions :

1. **DTM Syzygy du départ seulement.** Si la position est encore le FEN du catalogue, le trait est à l’utilisateur, la confiance est exacte, la catégorie est `win` et `dtm > 0`, cette distance est le `dtmAvant` du premier coup. La validation initiale ne connaît pas les positions suivantes. Le jeu ne rappelle pas Syzygy.
2. **Mat annoncé par le moteur de l’appareil**, après le départ. `score mate N` (UCI) est la distance du camp qui a le trait, en plies. Après le coup de l’utilisateur, un mat négatif pour l’adversaire devient la distance restante ; un échec et mat vaut 0. Après la réponse, la position où l’utilisateur doit rejouer est mesurée de la même façon. Un score en centipions n’est pas une distance de mat.

Si une de ces décisions n’a pas de distance fiable, la réussite est **enregistrée tout de suite** : résultat, une seule tentative, FEN de départ, camp, coups, durée, variante. La note reste nulle et le statut d’analyse est distinct (`pending`, `running`, `failed`, `estimated`, `scored`). L’écran affiche « Finale gagnée ! » puis « Note en cours… ». Une note absente s’écrit —/5 et n’entre pas dans les moyennes. La carte du thème ne laisse pas ce tiret seul : une analyse encore en attente affiche « Note en cours… », un échec affiche « Recalculer la note ». On n’affiche jamais 0/5 ni « 0 tentative comptabilisée » pour une victoire sans note. Un 0/5 reste réservé à l’échec.

Les mesures pendant le jeu (1 s) ne publient une note que si **toutes** les distances sont exactes (table ou mat observé). Un mélange avec le moteur court n’est pas publié : une passe complémentaire reprend la trajectoire.

**Budget total par tentative.** Le plafond d’une analyse n’est pas que chaque `go`. Une tentative a un budget mur de **25 s** (`POST_GAME_ATTEMPT_BUDGET_MS`), enregistré (`gradeDeadlineMs`, `gradeConsumedMs`). Une reprise continue le temps déjà consommé : elle ne redonne pas 90 s. Une nouvelle partie revendique le moteur et invalide le jeton d’analyse ; la note incomplète reste `pending` et se reprend plus tard. Les notes de **défense** et de **gain de pions** ne prennent pas le moteur : elles se calculent tout de suite, même si une autre partie a le transport.

**Budget progressif (mats élémentaires seulement).** Les paliers par défaut sont 400, 900, puis 1600 ms ; un quatrième palier à 3000 ms s’ajoute au-delà de 10 décisions. Un trou (`score mate` absent) n’arrête pas les décisions suivantes. Le palier suivant ne relance que les trous, en partant de la fin (plus proche du mat). Le curseur, les décisions déjà mesurées et le palier courant sont enregistrés. Le délai d’une passe s’adapte au nombre de décisions, **plafonné à 25 s**. Si le dernier palier n’a toujours pas de mat, un **repli mate-drive** donne une note **estimée**. Ce n’est pas une DTM. Un mat en 1 déjà sur l’échiquier et non pris est un relâchement, même si la pièce se rapproche. Une fois le roi adverse encadré, le repli suit la marche d’opposition (un axe, colonne à distance 2), pas une course de Chebyshev : `Ke4` plus court n’est pas mieux que `Ke3`. Les centipions, même gagnants, ne deviennent pas une distance. Mesure : un palier unique à 400 ms ne note jamais un deux-fous catalogue DTM 33 par DTM ; le repli mate-drive le note sans monopoliser le moteur. Lite n’annonce pas le mat à chaque passe.

**Objectif pédagogique.** Tous les thèmes ne passent pas par `score mate` :

- **Mats élémentaires** (dame, tour, deux fous) : efficacité de réalisation. Distance de mat si elle est complète (table ou moteur). Sinon mate-drive, jamais des centipions.
- **Gains de pions** (opposition, pion contre roi, cases clés, percée, Lucena, dame contre pion, etc.) : conserver le gain et progresser vers une promotion Q/R réellement gagnante. Le relâchement s’arrête à cette promotion (ou à l’arrêt du pion adverse). La chasse au mat qui suit n’est pas cet exercice. Pas de DTM exigée, pas de hausse de centipions.
- **Défenses** : conserver la nulle et réaliser le mécanisme (barrière, coin, carré, échecs latéraux, prise). Une nulle réussie n’exige pas un mat.

Les tables rétrogrades locales ont été mesurées puis **laissées hors service** à cause des défauts de **cette** construction. Voir `EXACT_EVAL.md`. Ce n’est pas une preuve qu’une DTM locale exacte est impossible. Les deux fous reçoivent une note **estimée** quand le moteur annonce un mat sur tout le chemin. Exact et estimé ne sont pas mélangés dans la même moyenne.

Le traitement est borné. Si l’analyse échoue, la victoire reste, la note reste vide, et « Recalculer la note » relance le même protocole. Aucune note n’est inventée pour masquer l’échec.

Une victoire déjà enregistrée sans note est rattrapée depuis sa trajectoire (`startFen`, camp, `moveSans`), sur la même tentative. Les gains de pions et les défenses sont recalculés tout de suite. Un mat élémentaire dont le moteur n’a pas publié de distance reçoit le repli mate-drive, sans nouvelle recherche et sans deuxième victoire. S’il n’y a pas de coups sauvegardés, la note reste vide : la trajectoire manque, et rien n’est inventé.

**Protocoles de mesure automatisée.** Un plafond de 20 coups utilisateur peut arrêter une réalisation correcte des deux fous (DTM 33). Le plafond de test suit la distance catalogue, avec un plancher de 36 coups pour ce thème. Les défenses choisissent un coup légal qui complète le mécanisme. Des trajectoires complètes enregistrées (`efficient` / `detour`) vérifient que la note baisse quand il y a des détours, **y compris sous les replis** (mate-drive, progression pion) : une couverture 100 % ne prouve pas que Qg2 vaut le mat en 1, ni qu’une tour en 7 coups vaut mieux que la marche d’opposition en 8. Le rapport sépare parties lancées, terminées (gagnées / perdues), interrompues par le plafond, et réussites effectivement notées.

On ne retombe pas sur la cible initiale. Une session reprise sans la trace des distances déjà jouées passe par cette analyse complémentaire. Les percées à 8 pièces n’ont pas de DTM de table : elles sont notées par la percée et la promotion gagnante, pas par `score mate`.

**Percée (vérification indépendante).** Une nulle automatisée ne tranche pas. Le FEN catalogue `7k/ppp5/8/PPP5/8/8/8/4K3 w` est la percée classique ; `b6` est légal. `Ke2` est 0,00 : ce n’est pas une FEN illégale. Lite à court délai peut manquer `b6`. Des lignes de référence indépendantes (les deux reprises après `b6`, `bxa5`, `exd5`) promeuvent et, pour trois d’entre elles, matent. Le joueur automatisé choisit `b6` / `bxa5` / `exd5` quand ces coups sont légaux.

**Défense.** Le relâchement compte les coups qui quittent une idée reconnue (barrière, tour latérale, coin salvateur, distance d’échec, entrée dans le carré, prise). Une autre méthode reconnue est notée de la même façon, y compris à 5 si elle est tenue sans relâchement. Une nulle obtenue par une méthode que l’exercice ne sait pas mesurer n’est pas un 2 automatique : la réussite de l’objectif reste, la qualité est « Qualité non évaluée ».

Une recherche qui ne sert qu’à détecter la perte de l’objectif ne devient pas une distance si elle ne renvoie qu’un score en centipions. Une perte confirmée termine la tentative.

### Seuils (`extra` = détours mesurés)

| extra | note |
| --- | --- |
| 0 | 5 |
| 1 | 4,5 |
| 2 | 4 |
| 3–4 | 3,5 |
| 5–6 | 3 |
| 7–8 | 2,5 |
| 9–12 | 2 |
| 13–16 | 1,5 |
| ≥ 17 | 1 |

Un seul tempo vaut un demi-point : l’échelle autorise les demis, et un tempo est plus petit que « plusieurs détours » (à partir de 3).

### Exemples calculés

Chemin parfait 5 → 4, puis 3 → 2, puis 1 → 0 : extra 0 → **5/5**. Le nombre de coups et la DTM initiale ne changent pas cette note.

L’adversaire facilite fortement, l’utilisateur perd plusieurs temps. Départ DTM 11. Décisions 11 → 12, puis 3 → 4, puis 1 → 0. L’ancienne règle voyait 3 coups contre `ceil(11 / 2) = 6` et donnait 5/5. Les plies perdus sont 2 + 2 + 0, extra 2 → **4/5**. Trois temps du même genre (11 → 12, 5 → 6, 3 → 4, puis mat) font extra 3 → **3,5/5**.

Garder la distance 5 → 5 : un ply perdu, extra 1 → **4,5/5**.

Distance mesurée, plus une nulle puis un retour au gain : extra 4 → **3,5/5**.

Une décision sans distance, même avec une DTM initiale : « Qualité non évaluée ».

Échec : **0/5**. Abandon : pas de note.

Nulle dont le mécanisme est tenu sans relâchement : **5/5**. Nulle dont la méthode n’est pas mesurée : « Qualité non évaluée — Défense réussie », pas 2/5.

Percée gagnée avec promotion Q/R tenue : note de progression (exacte), pas une DTM. Si la promotion n’est pas démontrée, la victoire reste, la qualité est « Qualité non évaluée ».

## Objectif

- Mat ou gain : pat et nulle = échec.
- Défense (« au moins la nulle ») : nulle ou gain du défenseur = réussite.
- Carré du pion, côté défenseur : arrêter le pion (entrer dans le carré, ou prendre le pion) = réussite.
- Carré du pion, côté pion : promouvoir et gagner. Une promotion reprise ou une position nulle ne suffit pas ; la table le dit.

## Fins défensives

Une évaluation 0,00 ne termine pas l’exercice. La position de départ non plus : l’égalité théorique du catalogue n’est pas une réussite immédiate. Une durée ou un nombre de coups ne prouve pas la défense. Si l’idée n’est jamais montrée, la partie s’arrête par une règle d’échecs (cinquante coups, triple répétition, pat) ou par le plafond technique de 80 coups utilisateur. Ce plafond interrompt sans note. Il n’est pas une cible.

- **Philidor** : après un coup de l’utilisateur, la tour est sur la rangée devant le pion et coupe le roi adverse. Si le pion atteint la 6e, un échec par-derrière est aussi exigé. La prise du pion termine.
- **Vancura** : la tour est sur la rangée du pion de tour, hors de sa colonne. La prise du pion termine.
- **Mauvais fou** : le roi atteint le coin de promotion que le fou ne contrôle pas.
- **Échecs latéraux** : deux échecs de rangée à au moins trois colonnes. Un échec plus court est un relâchement, pas une preuve. La prise du pion termine.
- **Carré, défense** : le roi entre dans le carré, ou prend le pion.
- **Pion de tour, défense** : le roi atteint le coin ou la case voisine du coin, ou prend le pion.

## Historique

`datasetVersion` reste `2.0.0` : la migration ne vide pas les tentatives. Les tentatives sans `scoreScale` sont marquées `legacy-10`. Elles ne sont pas divisées par deux et n’entrent pas dans la moyenne ni le record `/5`. Les cartes affichent l’ancien barème à part.

Une session en cours avant la mise à jour reprend le FEN et l’historique. Si la position de départ ne correspond plus au FEN du catalogue (opposition, Philidor, carré du pion ont été corrigés), la distance de mat du nouveau FEN n’est pas appliquée : la qualité reste non évaluée, sans 0 et sans conversion de l’ancien `/10`.

## Validation des positions

Les finales à 7 pièces ou moins sont revérifiées sur la table Syzygy de Lichess (`https://tablebase.lichess.ovh`). Pour chacune : catégorie, DTZ, DTM ou null, source `lichess-syzygy`, méthode `syzygy-7`. Confiance : exacte. Une catégorie `draw` est un résultat théorique exact ; ce n’est pas une distance de mat. La table a renvoyé `dtm = 0` sur ces nulles : cette sentinelle est conservée dans `dtmReported` et `dtm` reste null.

Au-delà (percées, 8 pièces), Stockfish 18 Lite, profondeur 16, source `stockfish-18-lite`, méthode `stockfish-18-lite-depth-16`. La catégorie `win` est la conclusion de la recherche, pas une table. `dtm` est null : les centipions ne sont pas une distance de mat. Le jeu ne contacte pas ces services.
