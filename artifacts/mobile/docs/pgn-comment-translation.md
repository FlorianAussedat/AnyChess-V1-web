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

- Session **utilisateur connecté** obligatoire (`role=authenticated` + `GET /auth/v1/user`). La clé **anon** est refusée.
- En-tête `X-AnyChess-Client: anychess-pgn-1` en plus de la session (insuffisant tout seul).
- 8 commentaires max / requête, 500 caractères / commentaire
- Quota DeepL Free 500 000 caractères / mois

## Consommation DeepL

`GET /functions/v1/pgn-translate` et le champ `usage` des réponses de traduction exposent `characterCount`, `characterLimit`, `remaining`. La clé n’est jamais renvoyée.

Quota documenté DeepL API Free : **500 000 caractères / mois**.

## Serveur et secret `DEEPL_API_KEY`

L’endpoint de production est la Edge Function **`pgn-translate`** du projet Supabase :

- URL : `https://<project-ref>.supabase.co/functions/v1/pgn-translate`
- Processus : `supabase/functions/pgn-translate`
- En-tête `X-AnyChess-Client: anychess-pgn-1` **et** JWT d’un utilisateur connecté (pas la clé anon)
- Ne pas mettre la clé dans GitHub Secrets, EAS, `EXPO_PUBLIC_*` ni dans Cursor

### Publier depuis le tableau de bord (téléphone, sans CLI)

1. Ouvrir [https://supabase.com/dashboard](https://supabase.com/dashboard) → projet `zqfxnzwtptepulmgpxhb`.
2. Menu **Edge Functions** → **Deploy a new function** / **Create function**.
3. Nom exact : `pgn-translate`.
4. Laisser **Verify JWT** activé (ON).
5. Effacer le modèle, coller **tout** `supabase/functions/pgn-translate/index.ts` (un seul fichier).
6. **Deploy**.
7. Secrets : `DEEPL_API_KEY` déjà enregistré ; ne pas le recoller.

Un appel avec seulement l’anon key doit renvoyer 401. AnyChess n’envoie le JWT utilisateur qu’après connexion sur l’écran Utilisateur.

`GET /functions/v1/pgn-translate` (même en-tête client) expose `usage` sans renvoyer la clé.

Le proxy Replit `artifacts/api-server` reste un repli de dev si `EXPO_PUBLIC_PGN_TRANSLATE_URL` est défini.

## Hébergement

La traduction de production tourne sur **Supabase Edge Functions** (offre gratuite du projet déjà créé). DeepL API Free : 500 000 caractères / mois, 0 €.

Le proxy Express `artifacts/api-server` reste disponible en local si `EXPO_PUBLIC_PGN_TRANSLATE_URL` pointe vers lui.
