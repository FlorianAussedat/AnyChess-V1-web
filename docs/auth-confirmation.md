# Confirmation d’adresse AnyChess

La confirmation d’e-mail reste **activée** (`mailer_autoconfirm = false`). Le bouton de l’e-mail doit garder `{{ .ConfirmationURL }}` : c’est Supabase qui vérifie le jeton, pas la page.

## Dans l’application

Après une inscription acceptée sans session :

> Un e-mail de confirmation t’a été envoyé. Ouvre-le pour activer ton compte, puis reviens te connecter.

- **Renvoyer l’e-mail** : 60 secondes minimum entre deux demandes. Au-delà du quota Supabase, le code `over_email_send_rate_limit` (HTTP 429) affiche « Trop de tentatives ».
- **Revenir à la connexion**.
- Pas de synchronisation sans session authentifiée.
- Codes distingués : `email_not_confirmed`, `invalid_credentials` / `invalid_grant`, réseau, `over_email_send_rate_limit`. Le reste n’affiche plus « La demande a été refusée ».
- Après connexion : ligne **Compte** et ligne **Sauvegarde** séparées. « Données synchronisées » seulement après un succès réel.

## Page interactive

`renderConfirmationPage` (`supabase/functions/auth-confirm/page.ts`) affiche :

- « Adresse confirmée ! Tu peux maintenant te connecter à AnyChess. » seulement si l’URL contient un jeton `type=signup` **et** que `GET /auth/v1/user` renvoie `email_confirmed_at`.
- « Ce lien a expiré ou n’est plus valable… » pour `error_code=otp_expired` (fragment `#error=…`, pas la query) ou un jeton refusé.
- « Cette page n’a pas confirmé ton adresse… » si on ouvre l’adresse sans ce jeton.

Pas de bouton vers l’application : `app.json` déclare le scheme `mobile`, sans App Link https et sans écran d’auth. Ce lien n’a pas été vérifié sur un appareil.

Le domaine gratuit `*.supabase.co` **réécrit `text/html` en `text/plain`** et ajoute `content-security-policy: default-src 'none'; sandbox` (Edge Functions et Storage). La phrase conditionnelle ne peut pas s’exécuter là sans domaine personnalisé (offre payante, non activée).

L’URL de redirection du projet pointe donc vers la fonction, qui répond en **texte brut** : elle ne dit pas que l’adresse est confirmée, et elle indique quoi faire si le lien a expiré.

Pour afficher la page HTML :

1. Générer le fichier avec `renderConfirmationPage({ supabaseUrl, anonKey })` (clé **publishable / anon**, jamais `service_role`).
2. L’héberger en HTTPS avec `Content-Type: text/html` (pas sur `*.supabase.co` gratuit).
3. Authentication → URL Configuration : remplacer Site URL et Redirect URLs par cette origine.
4. Les inscriptions envoient déjà `redirect_to` vers `https://<projet>.supabase.co/functions/v1/auth-confirm`. Le changer dans `authConfirmRedirectUrl` en même temps que le dashboard.

## E-mail

- Sujet : `supabase/templates/confirmation.subject.txt`
- Corps : `supabase/templates/confirmation.html` (bouton « Confirmer mon adresse e-mail », `{{ .ConfirmationURL }}`).

**Non appliqué** sur le projet : l’API répond `Email template modification is not available for free tier projects using the default email provider`. Le modèle en ligne reste le texte anglais par défaut, qui contient déjà `{{ .ConfirmationURL }}`. Pour le français : SMTP personnalisé, puis Authentication → Emails → Confirm signup, coller ces deux fichiers. Ne pas désactiver Confirm email.

## Réglages appliqués sur `zqfxnzwtptepulmgpxhb`

- `mailer_autoconfirm` : **false** (inchangé).
- Site URL et Redirect URLs : `https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/auth-confirm` (avant : `http://localhost:3000`, liste vide).
- Fonction `auth-confirm` déployée, `verify_jwt = false` (sinon le navigateur reçoit 401). `pgn-translate` reste `verify_jwt = true`.
- `DEEPL_API_KEY` non modifié.
- Bucket Storage `auth-confirm` créé pour essai puis **supprimé** : même bac à sable HTML.
