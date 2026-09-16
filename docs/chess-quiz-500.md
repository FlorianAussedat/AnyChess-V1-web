# Banque du quiz : 500 questions

Base : `cb51d2d`, fusion de `WIP-Major-Update-0.0.6.2` dans `main`.
La banque précédente comportait 210 questions. Cette révision conserve 68 identifiants
(avec corrections et incrément de révision si nécessaire), retire 142 entrées et ajoute
432 questions, soit **500 questions actives**. Les anciens modules contenant les
questions retirées sont supprimés du code, pas seulement filtrés à l'affichage.

## Contenu

| Contenu                                                         |  Nombre |
| --------------------------------------------------------------- | ------: |
| Questions existantes conservées ou corrigées, dont 11 portraits |      68 |
| Terminologie et mécanismes tactiques                            |      60 |
| Stratégie et décisions pratiques                                |      60 |
| Finales théoriques et principes de conversion                   |      70 |
| Règles, cas particuliers, notation                              |      42 |
| Histoire, championnats et joueuses/joueurs supplémentaires      |      30 |
| Plans d'ouverture                                               |      40 |
| Reconnaissance de variantes sur échiquier                       |      50 |
| Positions tactiques : 40 mats en un et 40 mats en deux          |      80 |
| **Total**                                                       | **500** |

Les catégories à l'exécution regroupent les questions par thème : certaines positions
de mat sont classées en finales. Les 130 échiquiers indiquent explicitement le trait.
Les 80 positions tactiques viennent du pack Lichess déjà livré dans le dépôt ; aucun
appel réseau ni moteur n'est ajouté au quiz. Les mauvais choix sont des coups légaux.
Les noms complets des pièces et les cases de départ/arrivée évitent les ambiguïtés FR/EN
et n'affichent pas de symbole `#` qui donnerait la réponse.

## Corrections notables

- `famous-games-002` : Kasparov était qualifié à tort de « programme ».
- `modern-013` : suppression du récit erroné des changements de fédération de Firouzja ;
  remplacement par son résultat vérifiable au Grand Swiss 2021.
- `players-012` : le jugement subjectif « plus forte joueuse » devient un fait de classement.
- `players-013` : suppression de l'anachronisme du titre de grand maître FIDE pour Philidor.
- `players-008` : question précise sur Smyslov chanteur baryton.
- Suppression de `visual-016` (prise en passant c5xd6 annoncée à tort en c6), de
  `visual-014` (fausse enfilade), des diagrammes dont le mauvais camp avait le trait,
  et des questions élémentaires sur le nombre de cases, le premier joueur, etc.
- Suppression des doublons de définition et des choix fantaisistes ou anachroniques.
- Les portraits gardent leurs actifs et identifiants. Leur texte alternatif ne révèle
  plus le nom du joueur avant la réponse.

## Sélection et historique

Les sessions restent à 10 questions, réponses mélangées. Le moteur choisit d'abord les
questions jamais présentées pour cette révision et diversifie les catégories parmi
elles. Après épuisement, les questions les plus anciennes reviennent en premier.

Seules les questions effectivement affichées sont mémorisées : interrompre une session
ne consomme pas ses questions suivantes. Historique local persistant `id@revision`,
maximum 2 000 entrées, via le stockage partagé et sa politique de récupération des
valeurs corrompues. Les votes et exclusions existants restent indépendants ; une
correction avec nouvelle révision retrouve une chance d'être montrée.

## Vérification

`test:quiz` exécute les tests du quiz et des portraits ainsi que `bankQuality.test.mjs`.
Le contrôle de mat est exhaustif sur l'horizon annoncé : tous les coups légaux à la
racine, puis toutes les défenses et tous les mats possibles au coup suivant. Il exige
un seul premier coup gagnant, vérifie les trois distracteurs, rejoue la ligne explicative
et retrouve la position dans le pack source. Il ne prétend pas évaluer au moteur les
conseils stratégiques rédigés.

Les séquences d'ouverture sont rejouées avec chess.js jusqu'au FEN affiché. Tous les
échiquiers vérifient que le camp qui vient de jouer n'a pas laissé son roi en échec.
Les tests couvrent aussi les 500 identifiants, les choix distincts, les doublons exacts,
les 50 sessions sans répétition, la reprise après interruption et les révisions.

## Sources de contrôle

Les champs `sources` des questions concernées servent de provenance éditoriale et
n'entraînent aucune requête dans l'application. Les formulations sont propres au quiz.

- [Lois FIDE applicables depuis 2023](https://handbook.fide.com/chapter/E012023), notamment
  roque, en passant, pièce touchée, positions mortes, abandon, répétitions et limites de coups.
- [Chronologie des champions, FIDE](https://worldchesschampionship2023.fide.com/chess-champions)
  et [championnes du monde, FIDE](https://womenworldchampionship2023.fide.com/world-champions).
  Les questions sont datées : aucune formulation « champion actuel » à maintenir.
- [Deep Blue, IBM](https://www.ibm.com/history/deep-blue).
- [Grand Swiss 2021, FIDE](https://www.fide.com/fide-chess-com-grand-swiss-firouzja-and-lei-triumph-in-riga/).
- [Olympiades 2024, FIDE](https://www.fide.com/triumphant-moments-celebrating-the-winners-of-45th-chess-olympiad/),
  [Olympiades 2022, ECU](https://www.europechess.org/chess-olympiad-2022-concluded-in-chennai/),
  [coupe Gaprindashvili, musée FIDE](https://museum.fide.com/exhibits/gaprindashvili-cup).
- [Candidats et Candidates 2024, FIDE](https://www.fide.com/gukesh-d-and-tan-zhongyi-are-world-championship-challengers/).
- [Coupe du monde 2023](https://worldcup2023.fide.com/).
- [Position de Lucena](https://www.chess.com/terms/lucena-position-chess) et
  [position de Philidor](https://www.chess.com/terms/philidor-position-chess), pour les méthodes théoriques.
- Noms et ordres de coups d'ouverture : corpus [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings),
  dont les TSV sont déjà présents dans `artifacts/mobile/lib/openings/data/`.
- Positions tactiques : pack local `lib/puzzles/data/puzzles.json`, avec URL et identifiant
  Lichess par question. Les labels du pack ne suffisent pas à valider une réponse : les
  preuves de mat sont recalculées.

## Intégration

Reprise du dossier autonome (export local `dffbbaa`) sur le `main` actuel (`cb51d2d`).
Aucun identifiant de banque ajouté après cette base n'a été trouvé sur `main` :
les 142 retraits et les 432 ajouts remplacent l'ancienne banque de 210 questions,
sans suppression silencieuse d'évolutions postérieures.

## Langues et limites

Les nouvelles questions rédactionnelles sont en français et utilisent le repli français
existant si l'application est en anglais. Les 80 nouveaux diagrammes tactiques et les
11 portraits ont une copie anglaise. Cette PR n'est donc pas une traduction anglaise
complète des 500 questions. Le rendu de l'écran et ses boutons sont conservés ; aucune
recette manuelle mobile n'a été réalisée dans cet environnement.

## Résultats de cette révision

- Tests ciblés quiz/portraits/rotation : **55 réussis sur 55**.
- Suite mobile complète : **1 039 réussis sur 1 040**. L'échec
  `mentalPresentation.test.ts:105` (« shows Trait aux under boards with primary accent »)
  est reproduit sur la base `cb51d2d` sans ces changements.
- TypeScript mobile : passe avec les types Node déjà installés explicitement exposés via
  `--typeRoots`. La commande standard remonte les mêmes erreurs de résolution `node:*`
  sur cette branche et sur `cb51d2d` ; aucun changement de dépendance n'a été ajouté.
- Aucun merge ni déploiement n'est effectué par cette PR.

