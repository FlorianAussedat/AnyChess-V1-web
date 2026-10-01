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

## Serveur et secret `DEEPL_API_KEY`

Le serveur qui héberge l’endpoint est le service **API Server** de ce projet Replit :

- Projet : [https://replit.com/@florianaussedat/AnyChess-V1-web](https://replit.com/@florianaussedat/AnyChess-V1-web)
- Processus : `artifacts/api-server` (`POST /api/pgn-comments/translate`)
- Ne pas mettre la clé dans GitHub Secrets, EAS, `EXPO_PUBLIC_*` ni dans Cursor

### Où saisir la clé (vous seul, dans Replit)

1. Ouvrez le projet Replit ci-dessus (connecté avec le compte `florianaussedat`).
2. En haut de l’éditeur : **Tools**.
3. Section **Setup** → **Secrets**.
4. **New Secret**.
5. **Key** : `DEEPL_API_KEY` (nom exact).
6. **Value** : collez la clé DeepL Free uniquement dans ce champ.
7. **Add Secret**.

Si l’app est déjà publiée (Autoscale), ajoutez **aussi** la même clé ici :

1. **Publishing** (publication).
2. **Adjust settings**.
3. **Production app secrets**.
4. **Key** `DEEPL_API_KEY`, puis enregistrer.

Redémarrez le service API (Run) ou republiez après l’ajout. Ne collez jamais la clé dans le chat ni dans le code.

## Hébergement

Le backend **existe déjà** dans ce dépôt (`artifacts/api-server`, service Replit `artifact.toml`). Il n’est **pas** publié aujourd’hui.

Coût avant déploiement :

| Poste | Quota / usage | Coût |
|---|---|---|
| DeepL API Free | 500 000 caractères / mois | 0 € |
| Replit Autoscale (hébergeur déjà câblé) | ~1 $ / mois de base + compute/requêtes selon le trafic | souvent couvert par les crédits Core ; à très faible trafic, quelques euros / mois au-delà des crédits |
| PostgreSQL | **non requis** pour cet endpoint | 0 € |

Ne déployez que lorsque la clé est dans les secrets (voir PR).
