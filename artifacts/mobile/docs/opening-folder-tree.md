# Arborescence des ouvertures (0.0.7)

Les dossiers d’ouvertures forment un arbre. Le lien est `RepertoireFolder.parentId` : l’identifiant stable du dossier parent, ou `null` pour une racine (Blancs, Noirs, sans couleur, ou À classer). Le nom affiché n’encode pas le chemin.

Le document reste la version 2, clé `anychess.repertoire.v2`. Les études gardent leur `id`, leur `folderId`, le PGN, les commentaires et les statistiques. L’historique de révision reste dans `anychess.openingLineMastery.v1`, indexé par l’identifiant du fichier.

## Migration

Au chargement, un dossier sans `parentId` devient une racine (`parentId: null`). Un parent inconnu, un cycle, ou un sous-dossier placé sous À classer est ramené à la racine. Une étude dont le dossier n’existe plus est rattachée à À classer. Rien n’est réimporté ni dupliqué. La copie migrée est réécrite une fois.

## Règles

- Un dossier peut contenir des sous-dossiers et des études.
- Les noms sont uniques entre frères (même parent, ou même couleur à la racine), pas dans toute la bibliothèque.
- Déplacer un dossier emporte ses descendants. Le placer dans lui-même ou dans un descendant est refusé.
- Supprimer un dossier vide retire seulement ce dossier. S’il contient quelque chose, la suppression exige `relocateContents` : le contenu rejoint le parent. À la racine, les sous-dossiers restent des racines et les études vont dans À classer. Les PGN ne sont pas effacés par la suppression d’un dossier.
- À classer reste un dossier système : pas de renommage, pas de suppression, pas de sous-dossier.
- Apprentissage et `buildFolderRepertoire` prennent les études du dossier et de ses sous-dossiers. La révision tire toujours au sort sur la liste plate des lignes, sans bonus lié à la profondeur.
- L’état ouvert/fermé est local (`anychess.openings.treeExpanded.v1`), pas synchronisé.
- L’import PGN (`Ouvertures → Gérer → Importer`) propose le dossier de destination, y compris un sous-dossier. Sans choix, l’étude va dans À classer.

La bibliothèque d’analyses de parties a son propre arbre et n’est pas modifiée par cette migration.
