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

Deux mesures, jamais une conversion de centipions.

1. **Distance de mat exacte** (Syzygy DTM, en plies, trait à l’utilisateur au départ). Minimum = `ceil(DTM / 2)`. C’est le plus court gain contre la meilleure défense, pas une cible pédagogique stockée. `extra = max(0, coups − minimum) + 4` par perte temporaire du résultat ensuite récupérée. Plusieurs coups qui gardent la même distance valent 5. Une autre méthode gagnante plus longue n’est pénalisée que de ses coups en plus.

2. **Mécanisme du thème** (défenses). Le relâchement compte les coups qui quittent l’idée (barrière, tour latérale, coin salvateur, distance d’échec). Une répétition qui garde l’idée n’est pas un relâchement. Une nulle réglementaire qui ne montre pas l’idée vaut 2 (méthode fragile), pas 5.

Une trace de décisions incomplète n’efface pas une mesure exacte et n’invente pas de pénalité. Une recherche moteur courte pendant la partie sert à détecter la perte de l’objectif ; elle n’est pas traitée comme une distance de mat exacte. Une perte confirmée termine la tentative : on ne « récupère » pas contre la meilleure défense en cours de partie. La récupération est mesurée quand une trace complète est fournie (tests).

Si ni DTM exact ni mécanisme ne sont disponibles, la note est vide et le commentaire est « Qualité non évaluée ». Le résultat de l’objectif reste affiché. On n’attribue pas 5 par défaut. C’est le cas des percées à 8 pièces (Stockfish, pas une table).

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

Dame, DTM 13 plies, minimum 7 coups utilisateur.

- 7 coups, résultat conservé : extra 0 → **5/5**.
- 8 coups : extra 1 → **4,5/5**.
- 9 coups : extra 2 → **4/5**.
- 7 coups dont une nulle puis un retour au gain : extra 4 → **3,5/5**.
- 19 coups : extra 12 → **2/5**.
- 24 coups : extra 17 → **1/5**.
- Échec : **0/5**.
- Abandon : pas de note.
- Percée gagnée sans DTM : « Qualité non évaluée — Finale gagnée ».

## Objectif

- Mat ou gain : pat et nulle = échec.
- Défense (« au moins la nulle ») : nulle ou gain du défenseur = réussite.
- Carré du pion, côté défenseur : arrêter le pion (entrer dans le carré, ou prendre le pion) = réussite.
- Carré du pion, côté pion : promouvoir et gagner. Une promotion reprise ou une position nulle ne suffit pas ; la table le dit.

## Fins défensives

Une évaluation 0,00 ne termine pas l’exercice. Une durée ou un nombre de coups ne prouve pas la défense.

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

Les finales à 7 pièces ou moins sont revérifiées sur la table Syzygy de Lichess (`https://tablebase.lichess.ovh`). Confiance : exacte. Au-delà (percées, 8 pièces), Stockfish 18 Lite, profondeur 16. Confiance : moteur, pas une preuve de table. Le jeu ne contacte pas ces services.
