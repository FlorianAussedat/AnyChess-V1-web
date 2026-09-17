# Ouvertures : variantes, indices et entrées PGN

Base : main cb51d2d40763afd68a97550d4bf69ba8a1c729d8, vérifié sur GitHub.
Branche publiée : `cursor/openings-variants-files-0b65` (contenu de `codex/openings-variants-files`). Aucune fusion ni déploiement.

Le parseur conserve les vrais chemins PGN racine-feuille, variantes imbriquées comprises, avant fusion des transpositions. Les chemins identiques sont dédupliqués. La révision tire uniformément parmi ces chemins, tous dossiers sélectionnés confondus. L'historique privilégie les lignes non vues puis les plus anciennes, jusqu'à 10 000 entrées par sélection.

En jeu contre le répertoire, le fournisseur choisit une ligne complète compatible avec les coups déjà joués et la suit. Un autre choix théorique du joueur peut changer les continuations compatibles. La rotation de ce mode dure pendant la présence sur l'écran; celle de Continue la ligne est persistante.

L'indice affiche toutes les réponses attendues dans la notation choisie (« Cc3 ou e4 »). Il ne déplace ni n'annule de pièce, ne déclenche pas l'adversaire et reste dans le panneau de décision. Le bouton de retour permet ensuite de réessayer.

Chaque partie sélectionnée à l'import devient une entrée distincte avec son titre PGN et le nom de fichier source visible. Les collisions de noms techniques reçoivent le suffixe habituel. Renommage volontaire. Actions par entrée pour les deux modes. Les anciens fichiers multi-parties permettent aussi de sélectionner chaque partie sans migration ni réimportation.

Le sélecteur affiche maintenant la limite réellement configurée (100 dans Ouvertures).

Validation : 57 tests ciblés réussis. Suite complète : 1 033/1 034, seul échec connu préexistant mentalPresentation.test.ts (« shows Trait aux under boards with primary accent »). TypeScript passe avec les types Node installés explicitement exposés via --typeRoots. Pas de recette visuelle sur téléphone dans cet environnement.

