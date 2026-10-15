# Confirmation d’adresse AnyChess

La confirmation d’e-mail reste **activée** (`mailer_autoconfirm = false`). Le bouton de l’e-mail doit garder `{{ .ConfirmationURL }}` : c’est Supabase qui vérifie le jeton, pas la page.

Aucun forfait Supabase payant n’est activé par ce parcours : pas de Pro, pas d’add-on Custom Domain, pas de GitHub Pages. L’envoi passe par le SMTP Brevo gratuit configuré dans le tableau de bord Supabase. La clé SMTP n’est pas dans ce dépôt et ne doit pas y être copiée.

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

- **Service.** Un projet gratuit qui envoie avec le **SMTP par défaut de Supabase** ne peut plus modifier les modèles d’auth. L’API avait répondu : `Email template modification is not available for free tier projects using the default email provider`. Cette limite concernait le SMTP Supabase, pas le forfait à lui seul.
- **Ancienneté du projet.** Les projets gratuits **créés avant le 3 juin 2026** gardent leurs modèles déjà en place. Elle ne s’applique plus ici : l’envoi ne passe plus par le SMTP Supabase.
- **Forfait.** Les forfaits payants (Pro et au-dessus) peuvent continuer à modifier les modèles avec le SMTP Supabase. Ce n’est pas la seule façon de le faire.
- **SMTP personnel.** Un projet **gratuit** qui configure son propre SMTP peut modifier les modèles. Ce n’est pas un abonnement Supabase.

C’est le cas ici. Le SMTP Brevo (offre gratuite, sans domaine personnel, expéditeur AnyChess vérifié) est enregistré dans Supabase. Le modèle de **confirmation français** a été collé à la main. Un e-mail réel reçu sur le téléphone affiche le logo, les couleurs AnyChess et le texte français, avec le lien `{{ .ConfirmationURL }}`. Cette configuration n’est pas à refaire. La personnalisation n’est plus bloquée par le forfait ni par un jeton de gestion.

Variables utiles, mêmes docs : `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, `{{ .RedirectTo }}` (l’adresse passée à l’inscription ou à `resetPasswordForEmail`, qui doit figurer dans Redirect URLs). Après vérification, la session est dans le **fragment** (`#access_token=…&type=signup` ou `type=recovery`), pas dans la query.

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

`SUPABASE_ACCESS_TOKEN` fourni à cet agent a été refusé par l’API de management (`HTTP 401`, jeton invalide). Cet agent n’a donc pas modifié en ligne : Site URL, Redirect URLs, modèles d’e-mail, nom d’expéditeur, fonction `auth-confirm`. Le modèle français a été collé ensuite dans le tableau de bord, et le SMTP Brevo aussi. Plus tard le même jour, quand le téléphone joignait le domaine du projet, le lien de confirmation a affiché la page Netlify « Adresse e-mail confirmée ! ». Cette page n’est pas la fonction texte. Le `redirect_to` d’AnyChess Dev suffit à l’expliquer si cette adresse est autorisée. La valeur actuelle de la Site URL n’a pas été relue.

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

Modèles dans `supabase/templates/` (sujet + HTML), aussi déclarés dans `supabase/config.toml` :

- confirmation d’inscription — bouton `{{ .ConfirmationURL }}`
- réinitialisation du mot de passe — même variable
- changement d’adresse — même variable
- lien magique et invitation — prêts, l’application ne les déclenche pas
- réauthentification — `{{ .Token }}`, pas un lien de succès

Le logo des e-mails est `https://sparkly-paprenjak-65f499.netlify.app/brand/anychess-logo.png`. Il répond une fois le site Netlify publié. Le mot « AnyChess » est aussi en texte, et l’image a `alt="AnyChess"`. Couleurs `#0B1728`, `#102040`, `#F5A623`, tableau `bgcolor` pour Gmail, y compris une règle de mode sombre.

### Expéditeur

L’envoi utilise le SMTP Brevo déjà enregistré dans Supabase, avec l’expéditeur AnyChess vérifié. La clé reste dans le tableau de bord. Elle n’est pas lue, pas redemandée, et pas recopiée ici. Ne pas remplacer cette configuration.

### Ce qui est en ligne, et ce qui reste dans le dépôt

Les modèles bilingues de **confirmation**, de **récupération du mot de passe** et de **changement d’adresse** sont installés dans le tableau de bord. Ils ne sont pas remplacés par une ancienne configuration. Le dépôt en garde la copie correspondante, sans secret : `confirmation.html`, `recovery.html`, `email_change.html` et leurs sujets. Le français est la branche `else`. L’anglais part si `data.language` vaut `en`. Le bouton reste `{{ .ConfirmationURL }}`.

La confirmation française a été reçue sur le téléphone (logo, couleurs, texte français). La réception des versions anglaises, du mot de passe oublié et du changement d’adresse n’a pas été rejouée ici.

Ces modèles sont dans le dépôt, bilingues, avec le même logo et les mêmes couleurs, et **ne sont pas signalés comme installés** :

| E-mail | Fichiers | Variable | Déclenché par l’app |
|---|---|---|---|
| Lien magique | `magic_link.html`, `magic_link.subject.txt` | `{{ .ConfirmationURL }}` | non |
| Invitation | `invite.html`, `invite.subject.txt` | `{{ .ConfirmationURL }}` | non |
| Réauthentification | `reauthentication.html`, `reauthentication.subject.txt` | `{{ .Token }}` | oui, si Supabase demande un code |

Les coller ne modifie pas le SMTP ni les trois modèles déjà en place. Ne pas désactiver Confirm email. Ne pas remplacer `{{ .ConfirmationURL }}` par une page qui annoncerait le succès toute seule.

## Réglages déjà appliqués sur `zqfxnzwtptepulmgpxhb`

- SMTP Brevo, offre gratuite, expéditeur AnyChess vérifié : configuré dans le tableau de bord. La clé n’est pas dans le dépôt.
- Modèles bilingues installés à la main, à laisser en place : confirmation (le français a été reçu), récupération du mot de passe, changement d’adresse. Le dépôt ne les remplace pas.
- `mailer_autoconfirm` : **false** (inchangé).
- Site URL et Redirect URLs : la fonction `auth-confirm` (avant : `http://localhost:3000`, liste vide). **Inchangés** par cette page : voir le branchement ci-dessus.
- Fonction `auth-confirm` déployée, `verify_jwt = false` (sinon le navigateur reçoit 401). `pgn-translate` reste `verify_jwt = true`.
- `DEEPL_API_KEY` non modifié.
- Bucket Storage `auth-confirm` créé pour essai puis **supprimé** : même bac à sable HTML.

Le texte brut du dépôt dit maintenant qu’on ne peut pas confirmer le résultat depuis cette réponse, et demande de se connecter dans l’application. La fonction déjà déployée garde l’ancien texte tant qu’elle n’est pas redéployée. Ce redéploiement n’affiche toujours pas de HTML sur `*.supabase.co`.

## Recette Android

Le bundle AnyChess Dev (Metro, `.env.development`, profil EAS `development`) envoie `EXPO_PUBLIC_APP_CLIENT=dev` et `EXPO_PUBLIC_AUTH_CONFIRM_URL=https://sparkly-paprenjak-65f499.netlify.app/auth/confirm`. L’inscription, le renvoi et le mot de passe oublié ajoutent `client=dev` et `lang`. Le bouton ouvre alors `exp+mobile` / `com.anychess.app`. L’APK autonome déjà distribué n’est pas reconstruit : sans cette variable, son `redirect_to` reste la fonction, et le bouton ouvre `anychess` / `com.anychess.standalone`. Le bouton ne transmet pas le jeton. La confirmation française AnyChess est celle qui a été reçue. Les modèles bilingues de confirmation, de mot de passe oublié et de changement d’adresse sont déjà dans le tableau de bord. Le lien magique, l’invitation et la réauthentification ne sont pas signalés comme installés. Un envoi trop rapproché peut encore répondre `over_email_send_rate_limit`.

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

Sur le téléphone Vodafone, en 5G avec le DNS privé Android réglé sur `dns.google`, le lien de confirmation a ouvert la page AnyChess « Adresse e-mail confirmée ! ». Un Wi-Fi qui n’est pas le partage de ce téléphone aboutit aussi. Le retour vers l’écran Utilisateur et la connexion dans l’application après cette page ne sont pas encore vérifiés. Avec le DNS privé laissé sur Automatique, Vodafone affiche `ERR_TIMED_OUT`. Telstra, sur les données mobiles d’un autre téléphone, a confirmé l’adresse. Voir le diagnostic ci-dessous.

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

Le 15 octobre 2026, depuis la machine de l’agent, `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm` répond HTTP 200, `Content-Type: text/html; charset=UTF-8`, après la redirection vers `/auth/confirm/`. Le téléphone a aussi ouvert cette page. Un ancien essai avait reçu HTTP 401 tant que l’accès visiteur était limité à l’équipe.

## Diagnostic 5G du 15 octobre 2026

Les URL, le SMTP Brevo et le modèle français déjà reçu ne sont pas modifiés. Aucune adresse IP fixe ne remplace le domaine. TLS et la confirmation d’adresse restent actifs. Aucun proxy de jetons n’est ajouté.

### Essais des téléphones

Ces lignes décrivent ce qui a été observé sur les appareils, pas une mesure faite depuis la machine de développement. Aucun échec n’est confirmé sur Telstra.

| Réseau | Constat |
|---|---|
| Vodafone 5G, DNS privé Automatique | La page Netlify s’ouvre. Le domaine `zqfxnzwtptepulmgpxhb.supabase.co` ne s’ouvre pas. Le navigateur affiche `ERR_TIMED_OUT`. |
| Vodafone 5G, DNS privé `dns.google` | L’accès à Supabase répond, et le lien de confirmation ouvre « Adresse e-mail confirmée ! ». Le retour à Automatique reproduit l’échec. Un nouveau passage à `dns.google` aboutit encore. |
| Partage Wi-Fi du téléphone Vodafone | La confirmation échoue. Le partage utilise la 5G Vodafone. |
| Données mobiles Telstra, Wi-Fi coupé | La confirmation fonctionne. |
| Autre Wi-Fi, pas ce partage | La confirmation fonctionne. |

`dns.google` est un contournement sur le téléphone Vodafone. Il n’est pas demandé aux autres utilisateurs. `ERR_TIMED_OUT` est un délai dépassé. Ce n’est pas `ERR_NAME_NOT_RESOLVED`.

### Mesures depuis la machine de l’agent

Le 15 octobre 2026, vers 15:22 UTC. Ce n’est pas le réseau mobile du téléphone.

Trois résolveurs publics, en DNS sur TLS, répondent de la même façon pour `zqfxnzwtptepulmgpxhb.supabase.co` : `dns.google`, `one.one.one.one`, `dns.quad9.net`.

| Type | Réponse commune |
|---|---|
| A | `104.18.38.10`, `172.64.149.246` |
| AAAA | aucune adresse (NOERROR, zéro réponse) |
| CNAME | aucune |
| HTTPS | `1 . alpn="h3,h2" ipv4hint=104.18.38.10,172.64.149.246` |
| SVCB | aucune |

Depuis cette machine, `GET https://zqfxnzwtptepulmgpxhb.supabase.co/auth/v1/health` atteint les deux adresses IPv4 en HTTP/2. Les deux répondent HTTP 401, corps « No API key found in request », en-tête `sb-error-code: UNAUTHORIZED_MISSING_API_KEY`. Le `cf-ray` indique le site Cloudflare `IAD`. La page de statut publique Supabase indique « All Systems Operational » (dernière mise à jour de cette page : 13 octobre 2026). Les journaux Auth du projet ne sont pas lisibles ici : l’API de gestion répond 401 « Invalid access token ».

Le nom Netlify, interrogé en DNS sur HTTPS chez Google et Cloudflare, a des adresses IPv4 et IPv6, et un enregistrement HTTPS `alpn=h2` seulement. Cela sert de contraste : le téléphone ouvre Netlify pendant que le domaine du projet échoue.

### Ce que cela démontre

La cause précise n’est pas établie. QUIC n’est pas l’explication principale. L’échec confirmé est celui de Vodafone en DNS privé Automatique, y compris pour un autre téléphone qui passe par son partage Wi-Fi. Le même téléphone Vodafone confirme l’adresse avec `dns.google`. Telstra, sur ses propres données mobiles, confirme aussi. Un autre Wi-Fi confirme. Le projet n’a pas d’adresse IPv6. Ces succès écartent une panne générale du projet et un échec Telstra.

L’enregistrement HTTPS public annonce `h3` et `h2`. Les trois résolveurs publics consultés donnent les mêmes adresses. Ils ne sont pas le résolveur Vodafone. Deux hypothèses restent ouvertes :

- le résolveur utilisé en Automatique sur Vodafone ne répond pas à temps, ou ne rend pas ces adresses ;
- il rend les mêmes adresses, et la connexion qui suit expire (`ERR_TIMED_OUT`).

Le suivi de clics Brevo n’explique pas cet échec. L’accès direct à `/auth/v1/health` échouait déjà avant Brevo. L’aide Brevo documente l’anonymisation des ouvertures et des clics, qui ne retire pas la redirection de suivi. La coupure du suivi transactionnel n’est pas un réglage décrit pour l’offre gratuite : les réponses publiques de Brevo la réservent à une demande, pour des comptes Enterprise. On ne suppose pas que cette coupure existe sur le compte actuel. Le SMTP enregistré dans Supabase n’est pas modifié pour l’essayer.

### Vérification reçue

L’erreur demandée est arrivée : sur Vodafone, DNS privé Automatique, le navigateur affiche `ERR_TIMED_OUT`. Les essais complémentaires sont prévus demain. Aucun nouvel essai n’est demandé maintenant.

### Signalement préparé, non envoyé

Texte prêt pour Supabase ou pour l’opérateur. Il n’a pas été transmis.

> Projet `zqfxnzwtptepulmgpxhb`. Le 15 octobre 2026, téléphone Android en 5G Vodafone, DNS privé Automatique : le navigateur affiche `ERR_TIMED_OUT` vers `zqfxnzwtptepulmgpxhb.supabase.co`, alors que l’hôte Netlify de la page de confirmation s’ouvre. DNS privé `dns.google`, même téléphone et même 5G Vodafone : Supabase répond et le lien affiche « Adresse e-mail confirmée ! ». Le retour à Automatique reproduit l’échec. Un autre téléphone relié au partage Wi-Fi de ce Vodafone échoue aussi. Ses propres données Telstra, Wi-Fi coupé, confirment l’adresse. Aucun échec n’est confirmé sur Telstra. Depuis une autre machine, `dns.google`, `one.one.one.one` et `dns.quad9.net` répondent A `104.18.38.10` et `172.64.149.246`, sans AAAA, sans CNAME, HTTPS `alpn=h3,h2`. Ces résolveurs publics ne sont pas celui de Vodafone. Les deux adresses répondent HTTP/2 401 sans clé API. Le statut public Supabase est opérationnel. Les journaux du projet ne sont pas joints. Merci d’indiquer ce que le résolveur Vodafone renvoie en Automatique pour ce nom, et si le délai vient de la résolution ou de la connexion vers ces adresses.

## Ce qui reste côté Supabase

Le SMTP et le modèle de confirmation français sont déjà en place dans le tableau de bord. Le jeton de gestion de cet agent ne sert pas à les modifier. Il ne bloque pas non plus l’édition des autres modèles : elle se fait dans Authentication → Emails. Restent à vérifier ou à coller :

1. Page Netlify : vérifiée le 15 octobre 2026, HTTP 200 en `text/html`. Le téléphone l’a affichée, y compris « Adresse e-mail confirmée ! » quand le domaine Supabase était joignable.
2. Déployer la fonction `auth-confirm` de `main` (`verify_jwt = false`) pour le `POST` de vérification et la redirection `GET`. Non vérifié : le jeton de gestion est refusé.
3. Site URL : `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm`. Non lu dans le tableau de bord depuis ici. Le succès sur le téléphone peut venir du `redirect_to` déjà envoyé par AnyChess Dev.
4. Redirect URLs : cette page, `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm**`, et `https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/auth-confirm`. Même limite de lecture.
5. Laisser le SMTP Brevo et les modèles bilingues déjà installés (confirmation, récupération du mot de passe, changement d’adresse). Ne pas les remplacer. Les modèles encore absents du signalement sont le lien magique, l’invitation et la réauthentification, dans `supabase/templates/`.
6. Ne pas désactiver Confirm email.

Les APK autonomes déjà distribués n’ont pas besoin d’une nouvelle construction : leur `redirect_to` reste la fonction, qui enverra le navigateur vers Netlify après le redéploiement de la fonction. Le bouton y ouvre l’autonome. AnyChess Dev envoie `client=dev` et la page Netlify dès que son bundle JavaScript est rechargé (Metro). Aucun APK autonome n’est produit pour cela.
