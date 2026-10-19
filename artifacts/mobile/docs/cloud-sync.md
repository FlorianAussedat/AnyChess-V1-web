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
- Chaque compte a son espace `anychess.cloud.workspace.<user.id>.v1`. La déconnexion le met à jour, puis retire ces documents de l’espace actif.
- L’invité a son espace à part. Le connecter à un compte ne copie rien tout seul. L’import se fait seulement avec « Importer les données invitées ».
- Les études d’ouvertures n’existent que pour un compte. Sans session, la bibliothèque affichée est vide. Les études déjà sur l’appareil sont conservées dans `anychess.cloud.guestPgnVault.v1` (hors synchronisation) et ne sont copiées qu’après un constat Supabase enregistré dans `anychess.cloud.pgnPresence.v1`. Détail : `docs/pgn-ownership.md`.
- Une copie d’un compte trouvée dans l’ancien espace invité est conservée dans `anychess.cloud.legacyGuest.v1` et n’est ni affichée ni envoyée. Elle n’est pas effacée.
- `syncOnWifiOnly` reste le réglage du téléphone. La langue et les parties suivent le compte.
- Préférences : un compte déjà existant ne se fait pas remplacer par les valeurs par défaut du téléphone.
- Paramètres (langue, notation, son, voix, difficulté…) restent utilisables sans compte et restent sur l’appareil. La traduction DeepL et la synchronisation demandent une session au moment de s’en servir.
- Au démarrage, la session enregistrée est relue avant d’afficher l’écran invité. Une panne réseau laisse le compte connecté et les réglages locaux en place.
- Changement de compte : l’espace précédent est garé, l’autre compte est restauré ou parti d’un vide (pas de mélange).
- Suppressions PGN / dossiers / traductions / révisions : tombstones `syncDeletedIds` pour ne pas les ressusciter depuis un autre appareil.
- Hors ligne : l’app reste utilisable. Le statut affiché est **En attente**, **En attente — hors connexion**, **En attente — Wi-Fi uniquement**, **Synchronisation en cours**, **Synchronisé** ou **Erreur**. **Synchronisé** n’apparaît qu’après la confirmation du serveur. Une sauvegarde locale impossible affiche **La sauvegarde sur cet appareil a échoué.** La connexion du compte reste affichée à part.
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
3. **Authentication → URL configuration** : Site URL = `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm` une fois que Netlify sert cette page en `text/html`. Même origine dans Redirect URLs. Le détail est dans `docs/auth-confirmation.md`.
4. SQL Editor : exécutez `supabase/user_documents.sql` (RLS propriétaire, aucun secret DeepL).
5. **Project Settings → API** : copiez **Project URL** et **anon public**. Ne copiez pas `service_role`.
6. Replit → **Tools → Secrets / Configurations** (variables d’environnement de l’app Expo, pas les secrets serveur DeepL) :
   - `EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...` (clé anon)
   - Le bundle AnyChess Dev fixe déjà `EXPO_PUBLIC_APP_CLIENT=dev` et `EXPO_PUBLIC_AUTH_CONFIRM_URL=https://sparkly-paprenjak-65f499.netlify.app/auth/confirm` (`.env.development`, Metro, profil EAS `development`).
7. Relancez le bundler de développement pour recharger ce bundle. Ne reconstruisez pas l’APK autonome : son JavaScript déjà installé continue vers la fonction `auth-confirm`.
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

À vérifier **sur Android** : inscription réelle dans l’app installée, ouverture de l’e-mail sur l’appareil, second téléphone / désinstallation, bascule de compte, et synchro après coupure réseau. Le bouton de la page HTTPS ouvre `exp+mobile` / `com.anychess.app` lorsque le lien porte `client=dev`, et `anychess` / `com.anychess.standalone` sinon, sans y copier le jeton. Il n’y a pas d’App Link https. L’autoremplissage du gestionnaire de mots de passe Android n’a pas été exercé sur un téléphone dans cet environnement : les champs portent `autoComplete`, `textContentType` et `importantForAutofill`, et le bouton œil ne remplace pas ces attributs.

## Moment de la sauvegarde

La sauvegarde locale est immédiate dès que la modification est validée. L’envoi réseau est regroupé (délai court de l’ordonnanceur existant, 800 ms) et survit à la fermeture parce que la file est le document déjà écrit. La déconnexion ne relance pas une sauvegarde générale : elle gare l’espace du compte, y compris les opérations pas encore envoyées. Ces opérations ne partent jamais vers le compte suivant.

- Interrupteur ou choix simple : dès le changement.
- Formulaire avec « Enregistrer » : à la validation, pas à chaque lettre.
- Résultat, record ou exercice terminé : dès la validation.
- Partie ou activité en cours : état de reprise lorsque le mode le prévoit, sans la déclarer terminée.
- Suppression ou réinitialisation : dès la confirmation.

`syncOnWifiOnly` et l’adresse « Mémoriser mon adresse e-mail » (`anychess.device.rememberedEmail.v1`) restent sur le téléphone. Le mot de passe n’est jamais écrit dans AsyncStorage, les préférences, les journaux ou Supabase.

## Règle de conflit entre deux appareils

- Collections (PGN, parties, traductions, révisions, culture) : union par identifiant. Un tombstone `syncDeletedIds` gagne sur la copie distante. Pour une même fiche, le `updatedAt` le plus récent gagne.
- Dossiers d’ouvertures (0.0.7) : le document reste `anychess.repertoire.v2`. Chaque dossier peut porter `parentId` (identifiant du parent, ou `null` à la racine). La fusion conserve l’objet le plus récent, puis répare un parent manquant ou un cycle sans supprimer de PGN. L’état déplié de l’arborescence (`anychess.openings.treeExpanded.v1`) reste sur l’appareil.
- Historiques : union des listes.
- Records (tactique, nommer le coup, jouer le coup, mémorisation, quiz d’ouverture) : le meilleur score de la génération de réinitialisation la plus récente. Un `resetAt` plus tard annule les scores plus anciens, y compris un nombre sans horodatage. La série en cours (`currentByBand`) suit l’horodatage le plus récent, pas le maximum.
- Finales théoriques : la génération `scoreResetAt` déjà en place est conservée.
- Profil, avatar (`mascotId` dans le profil) et préférences de compte : le document dont `updatedAt` est le plus récent est gardé en entier. Pas de mélange champ par champ silencieux.
- Préférences du téléphone : jamais fusionnées avec le compte.

## Bilan par catégorie

| Catégorie | Sauvegarde locale | Déclencheur d’envoi | Correctif |
|---|---|---|---|
| PGN et dossiers | dès l’import, le déplacement ou la suppression | mutation locale → file → `sync()` | inchangé (tombstones) |
| Parties enregistrées | dès l’ajout ou la suppression | idem | inchangé |
| Traductions et file | dès la demande ou le résultat | idem | inchangé |
| Progression des révisions | dès la validation d’une ligne | idem | inchangé |
| Historiques (puzzles, culture) | dès l’entrée validée | idem | inchangé |
| Records tactique, nommer, jouer, mémo, quiz | dès le score validé ou la réinitialisation confirmée | idem, avec relecture si une synchro est déjà en cours | la réinitialisation garde le document et `resetAt` ; elle n’efface plus la clé |
| Finales | dès le résultat ou la réinitialisation | idem | génération déjà honorée |
| Préférences de compte | dès le changement d’un interrupteur | idem | inchangé |
| Profil et mascotte | dès « Enregistrer » ou le choix d’avatar | idem | `mascotId` stable, photo non remplacée toute seule |
| Photo d’avatar | cache local dès la validation du recadrage | envoi du fichier selon les règles réseau | inchangé |
| Session et mot de passe | jeton de session seulement | jamais le mot de passe | œil local, non journalisé |

Les records concernés par la réinitialisation sont : tactique (`anychess.puzzles.streaks.v1`), nommer le coup (`anychess.move-naming.session60.v1`), jouer le coup (`anychess.play-move.session60.v1`), mémorisation (`anychess.blind.memoryRecords.v1`), quiz d’ouverture (`anychess.openingQuiz.records.v1`). L’ancienne clé move-naming v1 n’est pas synchronisée. Les PGN ne passent pas par cette fusion.

## Suppression de compte

Le parcours client demande une confirmation dans le dialogue AnyChess, puis le mot de passe. L’appel va vers `POST /functions/v1/delete-account` avec le jeton de l’utilisateur. Aucune clé `service_role` n’est dans l’application. Hors connexion, l’app explique qu’Internet est nécessaire et ne met pas la suppression en attente. Le succès n’est annoncé qu’après une réponse serveur qui autorise l’effacement. Alors seulement : session fermée, espace de ce compte, ses sauvegardes, son cache d’avatar et son avatar en attente retirés, espace invité remis dans le slot actif. Les autres comptes et l’invité restent. Un échec, une fonction absente ou une session expirée ne retire rien en local.

Le code de la fonction est dans `supabase/functions/delete-account/index.ts`. `supabase/config.toml` demande `[functions.delete-account] verify_jwt = true`. Le 15 octobre 2026, la fonction est déployée avec cette vérification. Depuis la machine de l’agent, le même jour : `OPTIONS` répond 200, et un `POST {}` sans en-tête `Authorization` répond 401 passerelle `UNAUTHORIZED_NO_AUTH_HEADER` (plus un 404). Un `POST {}` qui atteint la fonction sans session utilisateur répond 401 `{"ok":false,"error":"reauth_required"}`. Ces deux réponses prouvent que la fonction est en ligne et qu’aucun compte n’est effacé. La suppression réelle d’un compte n’a pas été exécutée. Ne pas l’essayer sur un compte personnel. Si la fonction est absente, l’app dit que la suppression n’est pas disponible et ne retire rien en local.

Un redéploiement éventuel ne passe pas par `supabase config push` : cette commande réécrirait le SMTP Brevo et les modèles bilingues déjà installés (confirmation, récupération du mot de passe, changement d’adresse, ainsi que leurs sujets).

1. Installer la CLI Supabase et se connecter avec un jeton de gestion valide.
2. Depuis la racine du dépôt : `supabase functions deploy delete-account --project-ref zqfxnzwtptepulmgpxhb`.
3. Laisser `verify_jwt` activé. Les secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par l’hébergement de la fonction. Ne pas les copier dans l’application.
4. Un `POST` sans session doit rester un 401, pas un 404. Ne pas l’essayer sur un compte personnel.
