# Compte AnyChess et synchronisation cloud

Les données restent d’abord locales (AsyncStorage). Un compte optionnel les copie vers **Supabase Auth + Postgres** (offre gratuite) pour les retrouver sur un autre téléphone, puis sur mobile et web.

Aucune offre payante n’est activée par ce code. La clé DeepL **n’entre pas** dans ce module.

## Ce qui est synchronisé

| Document | Clé |
|---|---|
| Répertoires PGN + dossiers | `anychess.repertoire.v2` |
| Parties importées + dossiers | `anychess.gameLibrary.v1` |
| Traductions de commentaires + file | `anychess.pgnCommentTranslations.v1`, `anychess.pgnTranslationQueue.v1` |
| Progression des révisions | `anychess.openingLineMastery.v1` |
| Préférences | `anychess.preferences.user.v1` |
| Profil | `anychess.profile.user.v1` |
| Records / historiques / stats | quiz, visualisation, mémo, puzzles, culture, fins |

Restent **locaux** (éphémères) : session lecteur/analyseur (`gameSession`) et activités ouvertes (`activitySessions`).

## Comportement

- Inscription, connexion, déconnexion, mot de passe oublié : écran **Utilisateur**.
- Avant chaque connexion : sauvegarde locale `anychess.cloud.backup.<horodatage>.v1`.
- Première connexion depuis l’invité : les données locales sont fusionnées vers le compte (union par id, dédoublonnage PGN, pas d’écrasement).
- Préférences : un **nouveau** compte garde les réglages invités. Un compte **déjà existant** ne se fait pas remplacer par les valeurs par défaut du téléphone ; seuls les réglages modifiés à la main sur cet appareil sont repris.
- Paramètres (langue, notation, son, voix, difficulté…) restent utilisables sans compte et restent sur l’appareil. La traduction DeepL et la synchronisation demandent une session au moment de s’en servir.
- Au démarrage, la session enregistrée est relue avant d’afficher l’écran invité. Une panne réseau laisse le compte connecté et les réglages locaux en place.
- Changement de compte : l’espace précédent est garé, l’autre compte est restauré ou parti d’un vide (pas de mélange).
- Suppressions PGN / dossiers / traductions / révisions : tombstones `syncDeletedIds` pour ne pas les ressusciter depuis un autre appareil.
- Hors ligne : l’app reste utilisable ; la sauvegarde affiche **Hors ligne** ou **Synchronisation en cours…**, puis **Données synchronisées** seulement après un succès. La connexion du compte reste affichée à part.
- Une inscription qui attend la confirmation d’e-mail n’ouvre pas de session et ne lance pas la synchronisation.
- RLS : `auth.uid() = user_id`. La clé `anon` ne suffit pas à lire les documents d’un autre compte.
- Compte : Connecté / Non connecté. Sauvegarde : Données synchronisées / Synchronisation en cours… / Erreur de synchronisation (plus Hors ligne, Cloud non configuré).

## DeepL reste côté serveur

| Secret | Où | Jamais |
|---|---|---|
| `DEEPL_API_KEY` | Supabase → Edge Functions → Secrets (`pgn-translate`) | APK, `EXPO_PUBLIC_*`, ce module |
| `EXPO_PUBLIC_SUPABASE_URL` | Configurations Replit + build Android | — (URL publique) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Idem | **pas** la `service_role` |

Voir aussi `docs/pgn-comment-translation.md`.

## Étapes à votre charge (offre gratuite uniquement)

1. Créez un projet [Supabase](https://supabase.com) **Free** (pas Pro, pas add-ons payants).
2. **Authentication → Providers → Email** : laissez Email activé et **Confirm email** activé. Le message d’inscription, le renvoi et la page de retour sont décrits dans `docs/auth-confirmation.md`.
3. **Authentication → URL configuration** : tant que la page HTTPS n’est pas en ligne, Site URL = `functions/v1/auth-confirm` (texte brut sur `*.supabase.co`, pas `localhost`). Dès que le serveur web répond en `text/html` sur `/auth/confirm`, mettre cette URL en Site URL **et** dans Redirect URLs, puis `EXPO_PUBLIC_AUTH_CONFIRM_URL` au même endroit. Le détail, y compris le mot de passe oublié, est dans `docs/auth-confirmation.md`.
4. SQL Editor : exécutez `supabase/user_documents.sql` (RLS propriétaire, aucun secret DeepL).
5. **Project Settings → API** : copiez **Project URL** et **anon public**. Ne copiez pas `service_role`.
6. Replit → **Tools → Secrets / Configurations** (variables d’environnement de l’app Expo, pas les secrets serveur DeepL) :
   - `EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...` (clé anon)
   - `EXPO_PUBLIC_AUTH_CONFIRM_URL=https://<origine-web-déjà-en-ligne>/auth/confirm` (seulement quand cette page répond ; sinon omettre)
7. Build Android de développement : les variables `EXPO_PUBLIC_*` doivent être présentes **au moment du bundle** (EAS env / `.env` local avant `expo run:android`). Puis relancez le bundler.

## Lancement Metro (la config ne doit plus disparaître)

Expo n’envoie ces deux variables au téléphone que si elles existent dans le processus Metro au moment où il construit le bundle. Un changement de branche ou une VM neuve sans fichier `.env` rebundle « Cloud non configuré », même si le projet Supabase n’a pas changé.

- Le fichier lu est `artifacts/mobile/.env` (déjà ignoré par git : `.env` et `.env*.local`). Il survit à `git checkout`.
- `node scripts/ensure-supabase-public-env.mjs` (aussi `pnpm env:supabase`, et appelé par `pnpm dev` / `pnpm dev:client`) écrit uniquement `EXPO_PUBLIC_SUPABASE_URL=https://zqfxnzwtptepulmgpxhb.supabase.co` et la clé **anon** ou **publishable** déjà créée sur ce projet. Si les deux lignes sont déjà valides, il ne touche pas au fichier.
- Sans `.env`, le script interroge l’API projet avec `SUPABASE_ACCESS_TOKEN` et ne retient jamais `service_role` ni une clé `sb_secret_`. Il ne lit ni n’écrit `DEEPL_API_KEY`.
- `metro.config.js` relance ce script si le processus Metro n’a pas encore les deux variables, puis les recopie dans `process.env` avant le serializer. Un `expo start` lancé sans le script npm reste donc couvert sur cette machine.
- Après avoir créé ou modifié `.env`, redémarrer Metro (`expo start --dev-client --clear`) vide seulement le cache du bundler. Ça n’efface pas AsyncStorage, les sessions, les PGN ni les traductions.
8. Laissez `DEEPL_API_KEY` uniquement dans **Supabase → Edge Functions → Secrets**.

Sans ces deux variables publiques, l’écran Utilisateur affiche **Cloud non configuré** ; les données locales restent intactes.

## Tests automatisés (sans projet Supabase)

`lib/cloud/__tests__/cloudSync.test.ts` (backend mémoire) :

- fusion PGN sans doublon ni perte ;
- sauvegarde + migration vers un compte + restauration sur une installation vide ;
- isolation de deux comptes ;
- restauration d’une sauvegarde locale ;
- suppression qui ne revient pas depuis l’autre appareil ;
- hors ligne puis synchro ;
- aucune clé DeepL dans le client cloud.

`lib/cloud/__tests__/authFlow.test.ts` couvre la confirmation d’e-mail sans session, les codes d’erreur Supabase, le délai de renvoi, la page qui n’annonce « Adresse confirmée » qu’après vérification du jeton, le formulaire de nouveau mot de passe sur un lien `type=recovery`, et `GET /auth/confirm` en `text/html` sur le serveur web existant.

À vérifier **sur Android** : inscription réelle dans l’app installée, ouverture de l’e-mail sur l’appareil, second téléphone / désinstallation, bascule de compte, et synchro après coupure réseau. Le build actuel (`scheme` `mobile`, sans App Link https) n’ouvre pas l’app depuis le lien de confirmation.
