# Commentaires PGN bilingues — DeepL API Free

L’application traduit les commentaires anglais vers le français à l’import, et propose le rattrapage des fichiers déjà enregistrés. Les commentaires originaux restent dans le PGN source. Le lecteur affiche **Original / Français**.

## État actuel

| Élément | État |
|---|---|
| Fournisseur client | **Supabase Edge Function** `POST /functions/v1/pgn-translate` |
| Fournisseur serveur | **DeepL API Free** (`api-free.deepl.com` si la clé finit par `:fx`) |
| Clé `DEEPL_API_KEY` | **Edge Function Secret uniquement** — jamais dans l’APK, `EXPO_PUBLIC_*`, le dépôt ou les logs |
| Fournisseur de test | `FakePgnTranslationProvider` |
| Sans URL publique | `UnconfiguredPgnTranslationProvider` (originaux affichés) |
| Sidecar | `anychess.pgnCommentTranslations.v1` |
| File | `anychess.pgnTranslationQueue.v1` |
| Backend | Edge Function `supabase/functions/pgn-translate` (clé dans Project Settings → Edge Functions → Secrets) |

Les commentaires déjà `ready` / `done` ne sont pas renvoyés. Pause, reprise et progression restent dans AsyncStorage.

## Protection de l’endpoint

- En-tête obligatoire `X-AnyChess-Client: anychess-pgn-1`
- Jeton optionnel `ANYCHESS_TRANSLATE_APP_TOKEN` (secret serveur) + `X-AnyChess-Translate-Token`
- 8 commentaires max / requête, 500 caractères / commentaire
- JWT du projet requis (`verify_jwt`) ; quota DeepL Free 500 000 caractères / mois

## Consommation DeepL

`GET /functions/v1/pgn-translate` et le champ `usage` des réponses de traduction exposent `characterCount`, `characterLimit`, `remaining`. La clé n’est jamais renvoyée.

Quota documenté DeepL API Free : **500 000 caractères / mois**.

## Serveur et secret `DEEPL_API_KEY`

L’endpoint de production est la Edge Function **`pgn-translate`** du projet Supabase :

- URL : `https://<project-ref>.supabase.co/functions/v1/pgn-translate`
- Processus : `supabase/functions/pgn-translate`
- En-tête obligatoire `X-AnyChess-Client: anychess-pgn-1` + JWT anon/user (`verify_jwt`)
- Ne pas mettre la clé dans GitHub Secrets, EAS, `EXPO_PUBLIC_*` ni dans Cursor

### Où saisir la clé (vous seul, dans Supabase)

1. Dashboard du projet → **Project Settings → Edge Functions → Secrets**.
2. Nom exact : `DEEPL_API_KEY`.
3. Valeur : la clé DeepL API Free. Ne la collez jamais dans le chat ni dans le code.
4. Déployez `pgn-translate` (`supabase functions deploy pgn-translate --use-api`).

`GET /functions/v1/pgn-translate` (même en-tête client) expose `usage` sans renvoyer la clé.

Le proxy Replit `artifacts/api-server` reste un repli de dev si `EXPO_PUBLIC_PGN_TRANSLATE_URL` est défini.

## Hébergement

La traduction de production tourne sur **Supabase Edge Functions** (offre gratuite du projet déjà créé). DeepL API Free : 500 000 caractères / mois, 0 €.

Le proxy Express `artifacts/api-server` reste disponible en local si `EXPO_PUBLIC_PGN_TRANSLATE_URL` pointe vers lui.
