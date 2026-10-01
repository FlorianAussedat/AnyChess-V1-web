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
- Changement de compte : l’espace précédent est garé, l’autre compte est restauré ou parti d’un vide (pas de mélange).
- Suppressions PGN / dossiers / traductions / révisions : tombstones `syncDeletedIds` pour ne pas les ressusciter depuis un autre appareil.
- Hors ligne : l’app reste utilisable ; statut **Hors ligne** ou **En attente**, synchro au retour du réseau / au premier plan / bouton Synchroniser.
- RLS : `auth.uid() = user_id`. La clé `anon` ne suffit pas à lire les documents d’un autre compte.
- Statut : Synchronisé / En attente / Erreur (plus Hors ligne, Non connecté, Cloud non configuré).

## DeepL reste côté serveur

| Secret | Où | Jamais |
|---|---|---|
| `DEEPL_API_KEY` | Supabase → Edge Functions → Secrets (`pgn-translate`) | APK, `EXPO_PUBLIC_*`, ce module |
| `EXPO_PUBLIC_SUPABASE_URL` | Configurations Replit + build Android | — (URL publique) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Idem | **pas** la `service_role` |

Voir aussi `docs/pgn-comment-translation.md`.

## Étapes à votre charge (offre gratuite uniquement)

1. Créez un projet [Supabase](https://supabase.com) **Free** (pas Pro, pas add-ons payants).
2. **Authentication → Providers → Email** : activez Email. Pour le build Android de développement, décochez **Confirm email** afin de pouvoir vous connecter tout de suite. Sinon, l’app demandera de confirmer l’e-mail.
3. **Authentication → URL configuration** : Site URL = l’URL Replit/web de l’app (récupération de mot de passe).
4. SQL Editor : exécutez `supabase/user_documents.sql` (RLS propriétaire, aucun secret DeepL).
5. **Project Settings → API** : copiez **Project URL** et **anon public**. Ne copiez pas `service_role`.
6. Replit → **Tools → Secrets / Configurations** (variables d’environnement de l’app Expo, pas les secrets serveur DeepL) :
   - `EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...` (clé anon)
7. Build Android de développement : les variables `EXPO_PUBLIC_*` doivent être présentes **au moment du bundle** (EAS env / `.env` local avant `expo run:android`). Puis relancez le bundler.
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

À vérifier **sur Android** une fois le projet Supabase créé : inscription réelle, e-mail de récupération, second téléphone / désinstallation, bascule de compte, et synchro après coupure réseau.
