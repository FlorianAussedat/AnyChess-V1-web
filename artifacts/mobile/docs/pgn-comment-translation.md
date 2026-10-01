# Commentaires PGN bilingues — service réel

L’application traduit les commentaires anglais vers le français à l’import, et propose le rattrapage des fichiers déjà enregistrés. Les commentaires originaux restent dans le PGN source. Le lecteur affiche **Original / Français**.

## État actuel (cette branche)

| Élément | État |
|---|---|
| Fournisseur client par défaut | **MyMemory** (API publique, aucune clé) |
| Fournisseur de test | `FakePgnTranslationProvider` |
| Fournisseur « non configuré » | conservé pour les tests / repli |
| Sidecar | `anychess.pgnCommentTranslations.v1` |
| File | `anychess.pgnTranslationQueue.v1` |
| Endpoint serveur (optionnel) | `POST /api/pgn-comments/translate` dans `artifacts/api-server` |
| Clé payante dans cet environnement | **absente** |
| Hébergement du api-server | **non déployé** (stub local) |

Le client n’embarque aucun secret. `EXPO_PUBLIC_*` n’est pas utilisé pour une clé.

## Ce qui manque pour un service de production

1. **Fournisseur** — aujourd’hui MyMemory (qualité variable, quota). DeepL Free / Pro ou Google Cloud Translation donneraient un meilleur français d’échecs.
2. **Hébergement serveur** — `artifacts/api-server` n’est pas publié. Pour éviter l’appel direct MyMemory depuis l’APK, déployer le proxy (`POST /api/pgn-comments/translate`) et pointer `ANYCHESS_PGN_TRANSLATE_URL` vers cette URL publique.
3. **Clé** — aucune `DEEPL_API_KEY` / clé Google n’est présente. À poser uniquement sur le serveur, jamais dans l’APK.
4. **Coût estimé** (ordre de grandeur, 2026) :

| Option | Quota indicatif | Coût |
|---|---|---|
| MyMemory sans clé | ~5 000 caractères / jour / IP | 0 € |
| MyMemory + e-mail | ~50 000 caractères / jour | 0 € |
| DeepL Free | 500 000 caractères / mois | 0 € (clé personnelle) |
| DeepL Pro | au-delà, selon volume | à partir d’environ 5–7 € / mois + usage |
| Google Cloud Translation | facturé au million de caractères | ~20 $ / million |
| LibreTranslate auto-hébergé | illimité | VPS ~5 € / mois |

Pour une bibliothèque d’ouvertures annotée (quelques milliers de commentaires courts), DeepL Free suffit en général.

## Où l’utiliser dans l’app

- Ouvertures → Mes PGN : bouton par fichier + « Traduire la sélection » / « Traduire tous les PGN existants »
- Parties : mêmes actions
- Import ouvertures / bibliothèque : enqueue automatique
- Lecteur d’étude et AnyLyseur : bascule Original / Français
