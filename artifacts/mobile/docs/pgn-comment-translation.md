# Commentaires PGN bilingues — DeepL API Free

L’application traduit les commentaires anglais vers le français à l’import, et propose le rattrapage des fichiers déjà enregistrés. Les commentaires originaux restent dans le PGN source. Le lecteur affiche **Original / Français**.

## État actuel

| Élément | État |
|---|---|
| Fournisseur client | **Proxy HTTP** `POST /api/pgn-comments/translate` |
| Fournisseur serveur | **DeepL API Free** (`api-free.deepl.com` si la clé finit par `:fx`) |
| Clé `DEEPL_API_KEY` | **serveur uniquement** — jamais dans l’APK, `EXPO_PUBLIC_*`, le dépôt ou les logs |
| Fournisseur de test | `FakePgnTranslationProvider` |
| Sans URL publique | `UnconfiguredPgnTranslationProvider` (originaux affichés) |
| Sidecar | `anychess.pgnCommentTranslations.v1` |
| File | `anychess.pgnTranslationQueue.v1` |
| Backend | `artifacts/api-server` (Express déjà présent, **non déployé** tant que vous ne publiez pas) |

Les commentaires déjà `ready` / `done` ne sont pas renvoyés. Pause, reprise et progression restent dans AsyncStorage.

## Protection de l’endpoint

- En-tête obligatoire `X-AnyChess-Client: anychess-pgn-1`
- Jeton optionnel `ANYCHESS_TRANSLATE_APP_TOKEN` (secret serveur) + `X-AnyChess-Translate-Token`
- 8 commentaires max / requête, 500 caractères / commentaire, corps JSON 16 ko
- 15 requêtes / minute / IP, 40 commentaires / minute / IP, 20 000 caractères / jour / IP

## Consommation DeepL

`GET /api/pgn-comments/usage` et le champ `usage` des réponses de traduction exposent `characterCount`, `characterLimit`, `remaining`. La clé n’est jamais renvoyée.

Quota documenté DeepL API Free : **500 000 caractères / mois**.

## Hébergement

Le backend **existe déjà** dans ce dépôt (`artifacts/api-server`, service Replit `artifact.toml`). Il n’est **pas** publié aujourd’hui.

Coût avant déploiement :

| Poste | Quota / usage | Coût |
|---|---|---|
| DeepL API Free | 500 000 caractères / mois | 0 € |
| Replit Autoscale (hébergeur déjà câblé) | ~1 $ / mois de base + compute/requêtes selon le trafic | souvent couvert par les crédits Core ; à très faible trafic, quelques euros / mois au-delà des crédits |
| PostgreSQL | **non requis** pour cet endpoint | 0 € |

Ne déployez que lorsque la clé est dans les secrets (voir PR).
