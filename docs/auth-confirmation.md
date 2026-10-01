# Confirmation d’adresse AnyChess

La confirmation d’e-mail reste **activée** (`mailer_autoconfirm = false`). Le bouton de l’e-mail doit garder `{{ .ConfirmationURL }}` : c’est Supabase qui vérifie le jeton, pas la page.

Aucun service payant n’est activé par ce parcours : pas de forfait Pro, pas d’add-on Custom Domain, pas de SMTP payant, pas de GitHub Pages.

## Dans l’application

Après une inscription acceptée sans session :

> Un e-mail de confirmation t’a été envoyé. Ouvre-le pour activer ton compte, puis reviens te connecter.

- **Renvoyer l’e-mail** : 60 secondes minimum entre deux demandes. Au-delà du quota Supabase, le code `over_email_send_rate_limit` (HTTP 429) affiche « Trop de tentatives ».
- **Revenir à la connexion**.
- Pas de synchronisation sans session authentifiée.
- Codes distingués : `email_not_confirmed`, `invalid_credentials` / `invalid_grant`, réseau, `over_email_send_rate_limit`. Le reste n’affiche plus « La demande a été refusée ».
- Après connexion : ligne **Compte** et ligne **Sauvegarde** séparées. « Données synchronisées » seulement après un succès réel.

## Limites officielles (service, hébergement, forfait)

Trois restrictions distinctes. Aucune n’impose à elle seule un abonnement Supabase pour terminer ce parcours.

### Modèles d’e-mail — le service d’envoi, pas le forfait seul

Source : [Changes to Email Template Customisation on Free Tier](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) (3 juin 2026) et [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates).

- **Service.** Un projet gratuit qui envoie avec le **SMTP par défaut de Supabase** ne peut plus modifier les modèles d’auth (confirmation, reset, magic link, etc.). Les modèles par défaut sont utilisés tels quels. L’API de ce projet a répondu : `Email template modification is not available for free tier projects using the default email provider`.
- **Ancienneté du projet.** Les projets gratuits **créés avant le 3 juin 2026** gardent leurs modèles déjà en place. Cette réponse d’API montre que l’édition est bloquée ici tant que l’envoi passe par le SMTP Supabase.
- **Forfait.** Les forfaits payants (Pro et au-dessus) peuvent continuer à modifier les modèles avec le SMTP Supabase. Ce n’est pas la seule façon de le faire.
- **SMTP personnel.** Un projet **gratuit** qui configure son propre SMTP (Resend, Postmark, SendGrid, Amazon SES, etc.) peut encore modifier les modèles. Ce n’est pas un abonnement Supabase. On n’en branche aucun dans ce dépôt.

Le modèle français du dépôt (`supabase/templates/confirmation.html`, bouton « Confirmer mon adresse e-mail », `{{ .ConfirmationURL }}`) **n’est pas appliqué**. Le modèle en ligne reste le texte anglais par défaut, qui contient déjà `{{ .ConfirmationURL }}`. Le parcours fonctionne avec ce lien. Le français attend un SMTP personnel, ou un forfait qui autorise l’édition. Ne pas désactiver Confirm email.

Variables utiles, mêmes docs : `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, `{{ .RedirectTo }}` (l’adresse passée à l’inscription ou à `resetPasswordForEmail`, qui doit figurer dans Redirect URLs). Après vérification, la session est dans le **fragment** (`#access_token=…&type=signup` ou `type=recovery`), pas dans la query.

### HTML des Edge Functions — le domaine d’hébergement, pas le quota du forfait

Sources : [Edge Function limits](https://supabase.com/docs/guides/functions/limits) et [XHTML responses are only allowed with a Custom Domain enabled](https://supabase.com/changelog/29633-xhtml-responses-are-only-allowed-with-a-custom-domain-enabled).

- **Hébergement.** Sur le domaine partagé `*.supabase.co`, un `GET` qui renvoie `text/html` est **réécrit en `text/plain`**. Même règle pour les Data APIs, les Edge Functions et Storage, pour limiter les abus sur le domaine commun. La fonction `auth-confirm` reste donc en texte brut. Ce n’est pas un plafond d’invocations.
- **Forfait, autre sujet.** La durée max d’un worker (150 s en gratuit, 400 s en payant), la mémoire, le nombre de fonctions : ces quotas ne rendent pas le HTML lisible.
- **Sous-domaine vanity** (`quelque-chose.supabase.co`) : réservé aux forfaits payants, et c’est **toujours** `*.supabase.co`. Il ne lève pas la réécriture HTML.
- **Custom Domain** : add-on payant d’un projet déjà sur un forfait payant ([Custom Domains](https://supabase.com/docs/guides/platform/custom-domains)). La même page précise que ce domaine **n’est pas prévu pour héberger un frontend** via les Edge Functions.

Une page lisible ne demande donc pas d’abonnement si un hébergement web ordinaire la sert en `Content-Type: text/html`. Un abonnement Supabase ne servirait que pour afficher ce HTML **depuis le domaine du projet**. On ne le prend pas.

## Page lisible sur l’hébergement web déjà là

Le processus web de l’app (`artifacts/mobile/server/serve.js`) sert déjà la page d’accueil en `text/html`. Il sert maintenant :

`GET /auth/confirm` → `Content-Type: text/html; charset=utf-8`

Même générateur que `renderConfirmationPage` (`supabase/functions/auth-confirm/page.ts`), avec la clé **anon / publishable** lue depuis `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` (jamais `service_role`). Sans ces deux variables, la route répond `503` en texte brut et ne dit pas que l’adresse est confirmée.

GitHub Pages n’est pas activé sur le dépôt. L’API (`paths = ["/api"]`) reste du JSON. On ne publie pas un nouvel hôte.

Ce que la page affiche :

- « Adresse confirmée ! Tu peux maintenant te connecter à AnyChess. » seulement si l’URL contient un jeton `type=signup` (ou `type=email`) **et** que `GET /auth/v1/user` renvoie `email_confirmed_at`.
- « Ce lien a expiré ou n’est plus valable… » pour `error_code=otp_expired` (fragment `#error=…`) ou un jeton refusé.
- « Cette page n’a pas confirmé ton adresse… » si on ouvre l’adresse sans ce jeton.
- Pour `type=recovery` avec `access_token` : formulaire « Nouveau mot de passe » / confirmation, puis `PUT /auth/v1/user` avec le jeton du lien. Succès : « Mot de passe mis à jour. Tu peux maintenant te connecter à AnyChess. » Ce n’est pas la phrase de confirmation d’adresse. Un magic link, une invitation ou un changement d’e-mail ne passent pas par ce formulaire.
- Pas de bouton vers l’application : `app.json` déclare le scheme `mobile`, sans App Link https. Le lien n’ouvre pas AnyChess. Ce parcours n’a pas été rejoué sur un téléphone.

### Brancher l’URL sans casser « Mot de passe oublié »

Aujourd’hui, Site URL et Redirect URLs du projet pointent vers la fonction texte `https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/auth-confirm`. Sans `redirect_to`, Supabase envoie **aussi** le lien de récupération vers cette Site URL. La fonction texte ne peut pas enregistrer un mot de passe : ce n’est pas un formulaire.

La page `/auth/confirm` traite les deux types de lien. On peut donc en faire la Site URL **une fois qu’elle répond en HTTPS** :

1. Repérer l’origine HTTPS déjà utilisée par ce serveur web (le déploiement qui sert déjà `/`). Ne pas inventer de domaine, ne pas activer GitHub Pages ni un domaine Supabase.
2. Ajouter `https://<cette-origine>/auth/confirm` dans Authentication → URL Configuration → **Redirect URLs**. On peut y mettre aussi la Site URL.
3. Au bundle de l’app (Replit / EAS, pas seulement le serveur) : `EXPO_PUBLIC_AUTH_CONFIRM_URL=https://<cette-origine>/auth/confirm`.
4. L’inscription, le renvoi et **Mot de passe oublié** envoient ce `redirect_to`. Une adresse `http://` est ignorée : l’app reste sur la fonction texte, pour ne pas viser un hôte qui n’est pas en ligne.
5. Tant que l’étape 3 n’est pas faite, les e-mails continuent vers la fonction texte. Ne pas changer la Site URL du projet avant que la page HTTPS réponde : les deux liens tomberaient sur un 404.

Avec Site URL = cette page :

- confirmation (`type=signup`) : phrase d’adresse confirmée seulement après `email_confirmed_at` ;
- récupération (`type=recovery`) : le formulaire enregistre le nouveau mot de passe (6 caractères minimum, comme le refus `weak_password`).

Ce dépôt **ne modifie pas** la Site URL live : l’origine publique du serveur web n’est pas figée ici, et la route n’est en ligne qu’après déploiement de cette branche.

## E-mail

- Sujet : `supabase/templates/confirmation.subject.txt`
- Corps : `supabase/templates/confirmation.html`

Le modèle de récupération par défaut utilise aussi `{{ .ConfirmationURL }}`. On ne le réécrit pas tant que l’édition est bloquée.

## Réglages déjà appliqués sur `zqfxnzwtptepulmgpxhb`

- `mailer_autoconfirm` : **false** (inchangé).
- Site URL et Redirect URLs : la fonction `auth-confirm` (avant : `http://localhost:3000`, liste vide). **Inchangés** par cette page : voir le branchement ci-dessus.
- Fonction `auth-confirm` déployée, `verify_jwt = false` (sinon le navigateur reçoit 401). `pgn-translate` reste `verify_jwt = true`.
- `DEEPL_API_KEY` non modifié.
- Bucket Storage `auth-confirm` créé pour essai puis **supprimé** : même bac à sable HTML.

La phrase ajoutée au texte brut (« mot de passe oublié ») est dans le dépôt. La fonction déjà déployée garde l’ancien texte tant qu’elle n’est pas redéployée. Ce redéploiement n’est pas nécessaire pour la page HTML.

## Recette Android

Build avec `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, et — dès que la page est en HTTPS — `EXPO_PUBLIC_AUTH_CONFIRM_URL`. Le scheme reste `mobile` : le lien ne ramène pas dans l’app. Quota indicatif du SMTP par défaut : peu d’e-mails par heure (`over_email_send_rate_limit`). Le modèle reçu est encore l’anglais par défaut.

1. Installer AnyChess et ouvrir **Créer un compte** (pseudo, e-mail, mot de passe).
2. L’app dit qu’un e-mail de confirmation a été envoyé. Le compte n’est pas connecté, rien n’est synchronisé.
3. Ouvrir l’e-mail sur le téléphone et toucher le lien.
4. La page HTTPS dit « Adresse confirmée », ou que le lien a expiré : dans ce cas, **Renvoyer l’e-mail** dans l’app.
5. Revenir dans AnyChess à la main.
6. **Se connecter** avec le même e-mail et le même mot de passe.
7. **Compte** : connecté. **Sauvegarde** : « Données synchronisées » seulement après une synchro réelle.

Mot de passe oublié, une fois `EXPO_PUBLIC_AUTH_CONFIRM_URL` et la Redirect URL en place :

1. **Mot de passe oublié**, saisir l’e-mail. Message : e-mail de récupération envoyé.
2. Ouvrir le lien. La page demande un nouveau mot de passe (deux champs, 6 caractères minimum) et dit « Mot de passe mis à jour » — pas « Adresse confirmée ».
3. Revenir dans AnyChess et se connecter avec le nouveau mot de passe.

Cette recette n’a pas été exécutée sur un appareil dans cette branche.

## Dépendance et ordre de fusion

Ne rien fusionner.

La PR **#87** (`cursor/auth-confirm-flow-3f7a`, confirmation d’e-mail) **dépend de la PR #86** (`cursor/cloud-account-sync-025c`, compte AnyChess et synchronisation cloud). #87 ne peut pas arriver sur `main` avant #86 : sans le compte cloud, il n’y a pas d’inscription à confirmer.

Cette branche (`cursor/auth-confirm-page-3f7a`) part de #87 et doit y être intégrée **avant** que #87 ne remonte. Elle ne se pose pas seule sur `main`.

Ordre :

1. **#86** → `main`.
2. **#87**, cette page comprise → la ligne de #86, puis `main`.
3. **#88** (paramètres invité, `cursor/guest-settings-access-3f7a`) → après #87, dont elle dépend.
4. **#90** (création / suppression de compte) et **#91** (diagnostic technique) : indépendantes l’une de l’autre, toutes deux après #88.
5. **#89** (écrans Ouvertures) → `main`, à part de ce parcours.
