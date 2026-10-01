# Commentaires PGN bilingues — configuration du service

L’application prépare automatiquement une version française des commentaires anglais à l’import, et propose le rattrapage des fichiers déjà enregistrés. **Aucun fournisseur réel n’est activé dans cette livraison.**

## État actuel

- Stockage séparé : `anychess.pgnCommentTranslations.v1`
- File d’attente persistante : `anychess.pgnTranslationQueue.v1`
- Fournisseur de production : `UnconfiguredPgnTranslationProvider` (aucun faux succès)
- Fournisseur de test uniquement : `FakePgnTranslationProvider`
- L’import, la lecture et l’export restent disponibles si la traduction attend ou échoue
- Le rattrapage des anciens PGN n’est lancé que par une action utilisateur

## Pour activer un vrai service (côté serveur)

Ne placez **aucun secret** dans l’APK, le bundle web ou une variable `EXPO_PUBLIC_*`.

Paramètres attendus, à fournir hors client :

| Paramètre | Rôle |
|---|---|
| URL du endpoint serveur (ex. `POST /api/pgn-comments/translate`) | Le client n’appelle que ce proxy |
| Clé / jeton du fournisseur | Uniquement sur le serveur |
| Langues | source `en`, cible `fr` |
| Taille max d’un lot | 8 commentaires (déjà borné côté client) |
| Taille max d’un commentaire | à définir côté serveur (rejet si trop long) |
| Quota / débit | retries limités, pas de balayage automatique de toute la bibliothèque |
| Glossaire | knight/cavalier, bishop/fou, rook/tour, queen/dame, pin/clouage, fork/fourchette |

Le serveur doit :

1. Recevoir `{ id, text, context }[]` déjà protégés (directives `[%eval]`, SAN, FEN).
2. Renvoyer `{ id, text }[]` avec les mêmes jetons inchangés.
3. Rejeter une réponse invalide plutôt que de l’enregistrer comme succès.

Tant que ces paramètres manquent, l’UI affiche honnêtement : « La traduction automatique attend la configuration du service. »
