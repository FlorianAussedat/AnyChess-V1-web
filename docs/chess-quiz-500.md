# Banque du quiz Culture générale

Base audité : `8efcb0d` (`main`, 27 septembre 2026).
La banque livrée à 500 questions mélangeait culture échiquéenne et exercices
de jeu (plans d’ouverture, reconnaissance de variantes, mats à trouver,
décisions stratégiques, méthodes de finale). Cette révision retire **287**
objets questions et conserve **213** questions actives. Rien n’est inventé
pour rétablir le total de 500. Les modules retirés sont supprimés du code,
pas seulement masqués.

Le mode distinct **« Quelle ouverture ? »** (`artifacts/mobile/lib/openingQuiz/`)
n’est pas modifié.

## Périmètre

Le Quiz pose des questions de culture : histoire, joueurs, compétitions,
règles, vocabulaire, nom d’un mat ou d’une structure. On peut **nommer ou
définir** une notion. On ne demande pas de trouver un coup, résoudre un mat,
choisir un plan, ni de connaître les variantes propres à une ouverture.

| Contenu                                                         |  Nombre |
| --------------------------------------------------------------- | ------: |
| Joueurs, histoire, compétitions et portraits (`retained.ts`)    |      68 |
| Terminologie, motifs tactiques et structures (`terminologyReviewed.ts`) |      60 |
| Règles et notation (`rulesReviewed.ts`)                         |      42 |
| Histoire et compétitions supplémentaires (`historyExtraReviewed.ts`) |      30 |
| Vocabulaire et faits de finale (`endgamesReviewed.ts`)          |      13 |
| **Total**                                                       | **213** |

Modules retirés en entier : plans d’ouverture (40), échiquiers d’ouverture (50),
positions de mat (80), stratégie / plans (60). Dans les finales, 57 questions
de méthode ou de décision ont été retirées ; 13 définitions ou faits restent.

Il n’y a plus d’échiquier dans cette banque. Les 11 portraits restent, avec
leur texte alternatif qui ne révèle pas le nom du joueur.

## Sélection et historique

Les sessions restent à 10 questions, réponses mélangées. Le moteur choisit
d’abord les questions jamais présentées pour cette révision et diversifie les
catégories parmi elles. Après épuisement des 213, les plus anciennes
reviennent. Historique local `id@revision` et votes / exclusions restent
attachés aux identifiants conservés ; une question retirée n’est plus posée.

## Vérification

`test:quiz` contrôle la validité du schéma, l’unicité des 213 identifiants,
les choix distincts, les portraits, la rotation sans répétition avant
épuisement, et la persistance de l’historique. Les anciennes preuves de mat
et le rejeu des 50 séquences d’ouverture ne s’appliquent plus à cette banque.

## Sources de contrôle

Les champs `sources` des questions concernées restent une provenance
éditoriale et n’entraînent aucune requête dans l’application.

- [Lois FIDE applicables depuis 2023](https://handbook.fide.com/chapter/E012023)
- [Chronologie des champions, FIDE](https://worldchesschampionship2023.fide.com/chess-champions)
  et [championnes du monde, FIDE](https://womenworldchampionship2023.fide.com/world-champions)
- [Deep Blue, IBM](https://www.ibm.com/history/deep-blue)
- [Grand Swiss 2021, FIDE](https://www.fide.com/fide-chess-com-grand-swiss-firouzja-and-lei-triumph-in-riga/)
- [Position de Lucena](https://www.chess.com/terms/lucena-position-chess) et
  [position de Philidor](https://www.chess.com/terms/philidor-position-chess),
  pour les noms de méthodes conservés
