# Confirmation d’adresse AnyChess

La confirmation d’e-mail reste **activée** (`mailer_autoconfirm = false`). Le bouton de l’e-mail doit garder `{{ .ConfirmationURL }}` : c’est Supabase qui vérifie le jeton, pas la page.

Aucun service payant n’est activé par ce parcours : pas de forfait Pro, pas d’add-on Custom Domain, pas de SMTP payant, pas de GitHub Pages. L’envoi des e-mails d’auth passe par le SMTP Brevo gratuit que l’utilisateur a configuré dans le dashboard Supabase, sans domaine personnel.

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

### Modèles d’e-mail

Source : [Changes to Email Template Customisation on Free Tier](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) (3 juin 2026) et [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates).

Le changelog du 3 juin 2026 décrit un projet gratuit qui envoie encore avec le SMTP par défaut de Supabase : l’API répond alors `Email template modification is not available for free tier projects using the default email provider`. Ce projet envoie avec le SMTP **Brevo** (offre gratuite, sans domaine personnel) configuré à la main dans le dashboard. Le nom d’expéditeur vérifié est **AnyChess**. La clé SMTP reste dans Supabase. Ce dépôt ne la contient pas, ne la remplace pas, et ne change pas l’adresse d’envoi.

L’édition des modèles dans le dashboard est disponible. Le modèle de confirmation **français** est en ligne. Un e-mail reçu sur le téléphone affiche le logo AnyChess, les couleurs AnyChess et le texte français, avec le lien `{{ .ConfirmationURL }}`. L’anglais de cette confirmation n’est pas installé. Les autres e-mails de compte ne sont pas installés. Confirm email reste activé.

Variables utiles, mêmes docs : `{{ .ConfirmationURL }}` pour la confirmation, la réinitialisation du mot de passe, le changement d’adresse, le lien magique et l’invitation (la doc Supabase garde ce nom aussi pour le reset). `{{ .Token }}` pour la réauthentification. `{{ .SiteURL }}`, `{{ .RedirectTo }}` (l’adresse passée à l’inscription ou à `resetPasswordForEmail`, qui doit figurer dans Redirect URLs), `{{ .Data }}` (langue : `{{ .Data.language }}`). `{{ .NewEmail }}` n’existe que dans le changement d’adresse. Après vérification, la session est dans le **fragment** (`#access_token=…&type=signup` ou `type=recovery`), pas dans la query.

### HTML des Edge Functions — le domaine d’hébergement, pas le quota du forfait

Sources : [Edge Function limits](https://supabase.com/docs/guides/functions/limits) et [XHTML responses are only allowed with a Custom Domain enabled](https://supabase.com/changelog/29633-xhtml-responses-are-only-allowed-with-a-custom-domain-enabled).

- **Hébergement.** Sur le domaine partagé `*.supabase.co`, un `GET` qui renvoie `text/html` est **réécrit en `text/plain`**. Même règle pour les Data APIs, les Edge Functions et Storage, pour limiter les abus sur le domaine commun. La fonction `auth-confirm` reste donc en texte brut. Ce n’est pas un plafond d’invocations.
- **Forfait, autre sujet.** La durée max d’un worker (150 s en gratuit, 400 s en payant), la mémoire, le nombre de fonctions : ces quotas ne rendent pas le HTML lisible.
- **Sous-domaine vanity** (`quelque-chose.supabase.co`) : réservé aux forfaits payants, et c’est **toujours** `*.supabase.co`. Il ne lève pas la réécriture HTML.
- **Custom Domain** : add-on payant d’un projet déjà sur un forfait payant ([Custom Domains](https://supabase.com/docs/guides/platform/custom-domains)). La même page précise que ce domaine **n’est pas prévu pour héberger un frontend** via les Edge Functions.

Une page lisible ne demande donc pas d’abonnement si un hébergement web ordinaire la sert en `Content-Type: text/html`. Un abonnement Supabase ne servirait que pour afficher ce HTML **depuis le domaine du projet**. On ne le prend pas.

## Vérifié le 15 octobre 2026

La fonction en ligne `GET https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/auth-confirm` répond **200** en `text/plain`. Le corps est le texte « Cette page n’a pas confirmé ton adresse… » (ou, après redéploiement de cette branche, le texte « Nous ne pouvons pas confirmer le résultat… »). Le navigateur du téléphone, en mode sombre, affiche ce texte brut en petit sur fond noir. Ce n’est pas une carte HTML : le domaine `*.supabase.co` réécrit `text/html` en `text/plain`, et le fragment `#access_token=…` n’est **pas** envoyé à la fonction. Elle ne peut donc pas distinguer une adresse confirmée, un lien expiré et une ouverture directe. Elle ne dit jamais « Adresse e-mail confirmée ».

Le parcours réel du lien d’e-mail reste celui de Supabase : `GET /auth/v1/verify?token=…&type=signup&redirect_to=…` vérifie le jeton, puis redirige vers la Site URL avec le jeton dans le **fragment**. Tant que cette Site URL est la fonction texte, la page d’arrivée ne peut pas afficher le résultat. L’adresse peut néanmoins être confirmée côté Supabase : il faut alors se connecter dans AnyChess. Confirm email reste activé.

`SUPABASE_ACCESS_TOKEN` fourni à un agent a été refusé par l’API de management (`HTTP 401`, jeton invalide). Ce dépôt n’appelle pas cette API. Il ne réécrit pas la Site URL, les Redirect URLs, le SMTP Brevo, l’adresse d’envoi, le modèle de confirmation français déjà en ligne, ni la fonction `auth-confirm`. Le SMTP Brevo (nom d’expéditeur AnyChess) et ce modèle français ont été posés à la main dans le dashboard. Les anciens liens continuent d’ouvrir la fonction texte tant que la Site URL n’a pas été remplacée par la page HTTPS, après déploiement de cette branche sur l’hébergement web déjà décrit (`GET /auth/confirm`).

Hôtes essayés et **non** utilisés pour la page : `anychess-v1-web.replit.app` (« This app isn’t live yet »), `anychess.app` (un autre site), GitHub Pages (API 403, site non activé), jsDelivr (le HTML est renvoyé en `text/plain`, donc le navigateur n’exécute pas la page). Le contournement SVG est abandonné. L’hôte de la page est Netlify, dossier publié `dist/confirm-site` uniquement.

## Page lisible sur l’hébergement web déjà là

Le processus web de l’app (`artifacts/mobile/server/serve.js`) sert déjà la page d’accueil en `text/html`. Il sert maintenant :

`GET /auth/confirm` → `Content-Type: text/html; charset=utf-8`

Même générateur que `renderConfirmationPage` (`supabase/functions/auth-confirm/page.ts`), avec la clé **anon / publishable** lue depuis `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` (jamais `service_role`). Sans ces deux variables, la route répond `503` en texte brut et ne dit pas que l’adresse est confirmée.

La page publique est le HTML généré par `scripts/build-confirm-site.mjs`, publié par Netlify depuis `main`. Le dossier déployé ne contient que `auth/confirm/index.html` et `brand/anychess-logo.png`. L’URL est `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm`, en `text/html`.

Ce que la page affiche, en français ou en anglais (`?lang=fr|en`, sinon la langue du navigateur, français par défaut) :

- « Adresse e-mail confirmée ! » seulement si l’URL contient un jeton `type=signup` (ou `type=email`) **et** que `GET /auth/v1/user` renvoie `email_confirmed_at`. `success=true`, l’ouverture de la page, ou un code PKCE sans jeton ne suffisent pas.
- « Ce lien n’est plus valable » pour `error_code=otp_expired` ou un jeton refusé.
- « Cette page n’a pas confirmé ton adresse » si on ouvre l’adresse sans preuve.
- « Vérifie ta connexion dans AnyChess » si le réseau ou le serveur empêche la vérification (`error=server_error`, HTTP 5xx, échec du `fetch`). Le fragment est conservé pour qu’un rafraîchissement puisse réessayer. Il est retiré de la barre d’adresse après un succès ou un lien mort. `Referrer-Policy: no-referrer`. Le jeton n’est pas recopié dans le bouton ni dans un journal.
- Bouton « Ouvrir AnyChess », sans redirection automatique. Il ouvre l’écran Utilisateur. `client=dev` vise AnyChess Dev (`exp+mobile://utilisateur`, paquet `com.anychess.app`). Toute autre valeur vise l’application autonome déjà distribuée (`anychess://utilisateur`, paquet `com.anychess.standalone`). Le paquet Android départage les deux applications lorsqu’elles sont installées ensemble. Un lien déjà publié qui utilise encore l’hôte `open` est ramené au même écran par l’application. Aucun jeton n’est ajouté. Si Android n’ouvre pas l’application, le texte « Tu peux aussi fermer cette page et ouvrir l’application. » reste visible.
- Pour `type=recovery` avec `access_token` : formulaire de nouveau mot de passe, puis `PUT /auth/v1/user`. Succès : « Mot de passe mis à jour », pas la phrase de confirmation d’adresse.
- Logo servi par le même hôte : `GET /brand/anychess-logo.png` (fichier du dépôt, pas Metro).

`app.json` sur cette branche décrit encore le client de développement (`mobile`, `com.anychess.app`). Le bouton n’utilise pas ce fichier pour l’autonome : il vise l’APK déjà livré. Il n’y a pas d’App Link https. Ce parcours n’a pas été rejoué sur un téléphone.

### Brancher l’URL sans casser « Mot de passe oublié »

Aujourd’hui, Site URL et Redirect URLs du projet pointent vers la fonction texte `https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/auth-confirm`. Sans `redirect_to`, Supabase envoie **aussi** le lien de récupération vers cette Site URL. La fonction texte ne peut pas enregistrer un mot de passe : ce n’est pas un formulaire.

La page `/auth/confirm` traite les deux types de lien. On peut donc en faire la Site URL **une fois que Netlify la sert en `text/html`** :

1. Laisser le site Netlify `sparkly-paprenjak-65f499` sur `main`, dossier publié `dist/confirm-site`, et le rendre public.
2. Vérifier `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm` en `text/html` et `https://sparkly-paprenjak-65f499.netlify.app/brand/anychess-logo.png` en `image/png`.
3. Ajouter cette page dans Authentication → URL Configuration → **Redirect URLs**, y compris `?client=` et `?lang=`. Garder aussi l’URL de la fonction `auth-confirm` pour les APK déjà distribués.
4. Le bundle AnyChess Dev envoie déjà `redirect_to` vers `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm?client=dev&lang=fr` (ou `lang=en`). Relancer Metro pour que le client de développement recharge ce bundle. L’APK autonome déjà distribué n’est pas reconstruit : il continue d’appeler la fonction.
5. Après redéploiement de la fonction, son `GET` redirige vers la page Netlify en ajoutant `client=app` s’il manque. C’est le parcours des APK déjà installés.

Avec Site URL = cette page :

- confirmation (`type=signup`) : phrase d’adresse confirmée seulement après `email_confirmed_at` ;
- récupération (`type=recovery`) : le formulaire enregistre le nouveau mot de passe (6 caractères minimum, comme le refus `weak_password`).

La Site URL live n’est pas modifiée par ce dépôt : le jeton de management Supabase est refusé. Elle se règle dans le dashboard après le premier déploiement Netlify.

## E-mail

Langue au moment de l’envoi : l’inscription envoie `data.language` (`fr` ou `en`), la langue de l’application, stockée dans `raw_user_meta_data`. Les modèles utilisent `{{ if eq .Data.language "en" }}`. Sans cette valeur, le français (défaut du produit) est utilisé. Les e-mails suivants (mot de passe, changement d’adresse) relisent cette métadonnée : la changer dans l’app après l’inscription ne réécrit pas un compte déjà créé. La page de retour, elle, suit `lang` au moment de la demande.

Modèles dans `supabase/templates/` (sujet + HTML), aussi déclarés dans `supabase/config.toml`. Chacun est bilingue (`{{ if eq .Data.language "en" }}`, français par défaut). Le logo est `https://sparkly-paprenjak-65f499.netlify.app/brand/anychess-logo.png` (`alt="AnyChess"`, le mot AnyChess est aussi en texte). Couleurs `#0B1728`, `#102040`, `#F5A623`, tableau `bgcolor` pour Gmail, y compris une règle de mode sombre.

| E-mail | Fichiers | Variable du bouton ou du code | Dans le dépôt | En ligne |
| --- | --- | --- | --- | --- |
| Confirmation d’inscription | `confirmation.subject.txt`, `confirmation.html` | `{{ .ConfirmationURL }}` | français et anglais | français seulement, reçu sur le téléphone |
| Réinitialisation du mot de passe | `recovery.subject.txt`, `recovery.html` | `{{ .ConfirmationURL }}` | français et anglais | non installé |
| Changement d’adresse | `email_change.subject.txt`, `email_change.html` | `{{ .ConfirmationURL }}` | français et anglais | non installé |
| Lien magique | `magic_link.subject.txt`, `magic_link.html` | `{{ .ConfirmationURL }}` | français et anglais | non installé |
| Invitation | `invite.subject.txt`, `invite.html` | `{{ .ConfirmationURL }}` | français et anglais | non installé |
| Réauthentification | `reauthentication.subject.txt`, `reauthentication.html` | `{{ .Token }}` | français et anglais | non installé |

Le lien magique et l’invitation sont prêts dans le dépôt ; l’application ne les déclenche pas. La réauthentification affiche un code, pas un lien de succès.

`config.toml` ne déclare pas d’autre e-mail d’auth. Les notifications de sécurité Supabase (mot de passe changé, adresse changée, téléphone, méthode de connexion, méthode de vérification) sont absentes de ce dépôt. Elles partent seulement si le projet les active. Ce dépôt ne les active pas.

### À coller dans le dashboard

Authentication → Emails → Templates. Pour chaque ligne encore absente : le sujet est le fichier `.subject.txt`, le corps est le fichier `.html`. Laisser le SMTP Brevo, l’adresse d’envoi, Confirm email, la Site URL et les Redirect URLs comme ils sont.

1. **Reset password** — `recovery.subject.txt` et `recovery.html`.
2. **Change email address** — `email_change.subject.txt` et `email_change.html`.
3. **Magic link** — `magic_link.subject.txt` et `magic_link.html`.
4. **Invite user** — `invite.subject.txt` et `invite.html`.
5. **Reauthentication** — `reauthentication.subject.txt` et `reauthentication.html` (`{{ .Token }}`).
6. **Confirm sign up**, seulement pour ajouter l’anglais — `confirmation.subject.txt` et `confirmation.html`.

Supabase n’a qu’un emplacement Confirm sign up. Y coller les fichiers du dépôt remplace le HTML français déjà reçu par la version bilingue. Le français reste le texte par défaut (`{{ else }}`). Le logo, les couleurs `#0B1728` / `#102040` / `#F5A623` et `{{ .ConfirmationURL }}` y sont les mêmes. Les cinq autres emplacements sont distincts : les coller laisse la confirmation française en place.

### Expéditeur

L’envoi passe par le SMTP Brevo déjà configuré (offre gratuite, sans domaine personnel). Le nom affiché est AnyChess. La clé SMTP et l’adresse d’envoi restent dans le dashboard. Ce dépôt ne les contient pas.

Ces fichiers concernent les prochains e-mails, une fois collés à la main. Ils ne changent pas les messages déjà reçus. Confirm email reste activé. Le bouton des e-mails à lien garde `{{ .ConfirmationURL }}`.

## Réglages déjà appliqués sur `zqfxnzwtptepulmgpxhb`

- `mailer_autoconfirm` : **false** (inchangé).
- Site URL et Redirect URLs : la fonction `auth-confirm` (avant : `http://localhost:3000`, liste vide). **Inchangés** par cette page : voir le branchement ci-dessus.
- Fonction `auth-confirm` déployée, `verify_jwt = false` (sinon le navigateur reçoit 401). `pgn-translate` reste `verify_jwt = true`.
- `DEEPL_API_KEY` non modifié.
- Bucket Storage `auth-confirm` créé pour essai puis **supprimé** : même bac à sable HTML.

Le texte brut du dépôt dit maintenant qu’on ne peut pas confirmer le résultat depuis cette réponse, et demande de se connecter dans l’application. La fonction déjà déployée garde l’ancien texte tant qu’elle n’est pas redéployée. Ce redéploiement n’affiche toujours pas de HTML sur `*.supabase.co`.

## Recette Android

Le bundle AnyChess Dev (Metro, `.env.development`, profil EAS `development`) envoie `EXPO_PUBLIC_APP_CLIENT=dev` et `EXPO_PUBLIC_AUTH_CONFIRM_URL=https://sparkly-paprenjak-65f499.netlify.app/auth/confirm`. L’inscription, le renvoi et le mot de passe oublié ajoutent `client=dev` et `lang`. Le bouton ouvre alors `exp+mobile` / `com.anychess.app`. L’APK autonome déjà distribué n’est pas reconstruit : sans cette variable, son `redirect_to` reste la fonction, et le bouton ouvre `anychess` / `com.anychess.standalone`. Le bouton ne transmet pas le jeton. L’envoi passe par le SMTP Brevo du dashboard. Supabase peut encore répondre `over_email_send_rate_limit`. L’e-mail de confirmation reçu est le modèle français (logo, couleurs, `{{ .ConfirmationURL }}`). Les autres modèles de compte restent ceux de Supabase tant qu’ils ne sont pas collés.

1. Installer AnyChess et ouvrir **Créer un compte** (pseudo, e-mail, mot de passe).
2. L’app dit qu’un e-mail de confirmation a été envoyé. Le compte n’est pas connecté, rien n’est synchronisé.
3. Ouvrir l’e-mail sur le téléphone et toucher le lien.
4. La page HTTPS dit « Adresse e-mail confirmée ! » seulement après vérification du compte, ou que le lien n’est plus valable : dans ce cas, **Renvoyer l’e-mail** dans l’app. Elle ne le dit pas seulement parce que la page s’est ouverte.
5. Le bouton « Ouvrir AnyChess » est utilisable. Si Android n’ouvre pas l’app, le texte pour la rouvrir à la main reste affiché.
6. **Se connecter** avec le même e-mail et le même mot de passe.
7. **Compte** : connecté. **Sauvegarde** : « Données synchronisées » seulement après une synchro réelle.

Mot de passe oublié, une fois `EXPO_PUBLIC_AUTH_CONFIRM_URL` et la Redirect URL en place :

1. **Mot de passe oublié**, saisir l’e-mail. Message : e-mail de récupération envoyé.
2. Ouvrir le lien. La page demande un nouveau mot de passe (deux champs, 6 caractères minimum) et dit « Mot de passe mis à jour » — pas « Adresse confirmée ».
3. Revenir dans AnyChess et se connecter avec le nouveau mot de passe.

Cette recette n’a pas été exécutée sur un appareil dans cette branche.

## Netlify

Le site déjà connecté est `sparkly-paprenjak-65f499`. Le fichier `netlify.toml` est à la racine. Netlify déploie `main` et ne publie que `dist/confirm-site`.

Réglages à laisser ou à corriger dans Project configuration → Build & deploy :

- Production branch : `main`
- Base directory : vide
- Build command : `node --experimental-strip-types scripts/build-confirm-site.mjs`
- Publish directory : `dist/confirm-site`
- Functions : aucune
- Variables d’environnement : aucune

Ne pas remettre le dossier publié sur la racine du dépôt : le premier déploiement (`01405d9`, sans `netlify.toml`) a publié toute l’application.

Le site est encore en accès privé (réponse HTTP 401, écran « Make public »). Project configuration → Access & security → Visitor access : **Anyone with the link** / rendre le site public. Tant que l’accès équipe est exigé, le lien d’e-mail ouvre la connexion Netlify au lieu de la page.

## Ce qui reste côté Supabase

Le jeton de management reste refusé (`HTTP 401`). Ce dépôt ne l’utilise pas. Déjà en place, posés à la main : SMTP Brevo, nom d’expéditeur AnyChess, modèle de confirmation français. Ce dépôt ne les réécrit pas. Restent à faire dans le dashboard, sans toucher au SMTP :

1. Vérifier que `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm` répond `text/html`.
2. Déployer la fonction `auth-confirm` de `main` (`verify_jwt = false`) pour le `POST` de vérification et la redirection `GET`.
3. Site URL : `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm`.
4. Redirect URLs : cette page, `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm**`, et `https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/auth-confirm`.
5. Coller les modèles encore absents, listés dans la section E-mail : reset password, change email address, magic link, invite user, reauthentication. L’anglais de la confirmation est dans le même emplacement que le français déjà reçu : le coller remplace ce HTML par la version bilingue du dépôt.
6. Laisser Confirm email activé. Laisser le SMTP Brevo et l’adresse d’envoi tels quels.

Sans l’étape 1, les liens n’ouvrent pas encore la page HTML. Les APK autonomes déjà distribués n’ont pas besoin d’une nouvelle construction : leur `redirect_to` reste la fonction, qui enverra le navigateur vers Netlify après le redéploiement de la fonction. Le bouton y ouvre l’autonome. AnyChess Dev envoie `client=dev` et la page Netlify dès que son bundle JavaScript est rechargé (Metro). Aucun APK autonome n’est produit pour cela.
