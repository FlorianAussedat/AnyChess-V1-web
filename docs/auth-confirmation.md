# Confirmation d’adresse AnyChess

La confirmation d’e-mail reste **activée** (`mailer_autoconfirm = false`). Supabase vérifie le lien (`{{ .ConfirmationURL }}`) avant d’ouvrir la page publique. Ouvrir la page sans jeton de type `signup` ne marque pas l’adresse comme confirmée.

## Dans l’application

Après une inscription acceptée sans session :

> Un e-mail de confirmation t’a été envoyé. Ouvre-le pour activer ton compte, puis reviens te connecter.

- **Renvoyer l’e-mail** : au plus une demande par minute côté application. Supabase peut en plus refuser au-delà de son quota (message « Trop de tentatives »).
- **Revenir à la connexion** : retour au formulaire, sans synchronisation.
- La synchronisation ne démarre qu’avec un jeton utilisateur. Une erreur de sauvegarde laisse le compte affiché comme connecté.

Codes GoTrue distingués : `email_not_confirmed`, `invalid_credentials` / `invalid_grant`, `over_email_send_rate_limit` / HTTP 429, coupure réseau, `weak_password`, `email_address_invalid`, `user_already_exists`. Les autres cas affichent « La demande n’a pas abouti », pas « La demande a été refusée ».

## Page de retour

`https://<project-ref>.supabase.co/functions/v1/auth-confirm`

- Jeton `type=signup` puis `GET /auth/v1/user` avec `email_confirmed_at` : « Adresse confirmée ! Tu peux maintenant te connecter à AnyChess. »
- `error_code=otp_expired` (souvent dans le fragment, pas la query) ou jeton refusé : lien expiré ou invalide.
- Page ouverte seule : le texte de vérification ne dit pas que l’adresse est confirmée.

Le build Android (`app.json`, `scheme` = `mobile`, paquet `com.anychess.app`) n’a pas d’App Link https ni d’écran d’auth pour ce lien. La page ne propose donc pas de bouton « ouvrir l’application ».

## E-mail

Fichiers :

- `supabase/templates/confirmation.subject.txt`
- `supabase/templates/confirmation.html`

Le bouton **Confirmer mon adresse e-mail** pointe vers `{{ .ConfirmationURL }}`. Ne pas remplacer cette variable par une URL fixe.

## Réglages Supabase (si l’API n’a pas été appliquée)

Projet `zqfxnzwtptepulmgpxhb` → Authentication → Emails → Confirm signup :

1. Sujet : contenu de `confirmation.subject.txt`.
2. Corps : coller `confirmation.html` tel quel, y compris `{{ .ConfirmationURL }}`.
3. Laisser **Confirm email** activé.
4. Authentication → URL Configuration :
   - Site URL : `https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/auth-confirm`
   - Redirect URLs : la même adresse.
5. Déployer la fonction `auth-confirm` avec `verify_jwt = false` (`supabase/config.toml`). Ne pas désactiver la vérification JWT de `pgn-translate`.
6. Ne pas modifier `DEEPL_API_KEY`.

L’état réellement appliqué sur le projet est noté dans la description de la pull request, pas seulement ici.
