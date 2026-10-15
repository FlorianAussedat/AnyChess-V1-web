/**
 * AnyChess auth emails. Supabase renders the Go condition with the language
 * stored at sign-up in user metadata (`data.language` = `fr` or `en`).
 * A missing value stays French, the product default.
 *
 * The button keeps `{{ .ConfirmationURL }}` or `{{ .Token }}`. It is never a
 * static page that only displays success.
 */

export const LOGO_URL = 'https://anychess-confirm.netlify.app/brand/anychess-logo.png';

const KINDS = {
  confirmation: {
    subject: {
      fr: 'Confirme ton adresse e-mail — AnyChess',
      en: 'Confirm your email address — AnyChess',
    },
    title: { fr: 'Bienvenue sur AnyChess !', en: 'Welcome to AnyChess!' },
    body: {
      fr: 'Confirme ton adresse e-mail pour activer ton compte et retrouver tes données synchronisées sur tes appareils.',
      en: 'Confirm your email address to activate your account and find your synced data on your devices.',
    },
    button: { fr: 'Confirmer mon adresse e-mail', en: 'Confirm my email address' },
    footer: {
      fr: 'Tu n’as pas créé de compte AnyChess ? Tu peux ignorer cet e-mail.',
      en: 'Didn’t create an AnyChess account? You can ignore this email.',
    },
    action: 'link',
  },
  recovery: {
    subject: {
      fr: 'Réinitialise ton mot de passe — AnyChess',
      en: 'Reset your password — AnyChess',
    },
    title: { fr: 'Choisis un nouveau mot de passe', en: 'Choose a new password' },
    body: {
      fr: 'Tu as demandé à réinitialiser le mot de passe de ton compte AnyChess. Ce lien est personnel.',
      en: 'You asked to reset the password for your AnyChess account. This link is personal.',
    },
    button: { fr: 'Choisir un nouveau mot de passe', en: 'Choose a new password' },
    footer: {
      fr: 'Tu n’as pas demandé cette réinitialisation ? Tu peux ignorer cet e-mail.',
      en: 'Didn’t ask for this reset? You can ignore this email.',
    },
    action: 'link',
  },
  email_change: {
    subject: {
      fr: 'Confirme ta nouvelle adresse e-mail — AnyChess',
      en: 'Confirm your new email address — AnyChess',
    },
    title: { fr: 'Confirme ta nouvelle adresse', en: 'Confirm your new address' },
    body: {
      fr: 'Confirme ce changement pour continuer à utiliser AnyChess avec ta nouvelle adresse e-mail.',
      en: 'Confirm this change to keep using AnyChess with your new email address.',
    },
    button: { fr: 'Confirmer la nouvelle adresse', en: 'Confirm the new address' },
    footer: {
      fr: 'Tu n’as pas demandé à changer d’adresse ? Tu peux ignorer cet e-mail.',
      en: 'Didn’t ask to change your address? You can ignore this email.',
    },
    action: 'link',
  },
  magic_link: {
    subject: { fr: 'Ton lien de connexion — AnyChess', en: 'Your sign-in link — AnyChess' },
    title: { fr: 'Connecte-toi à AnyChess', en: 'Sign in to AnyChess' },
    body: {
      fr: 'Utilise ce lien pour ouvrir une session sur ton compte AnyChess.',
      en: 'Use this link to open a session on your AnyChess account.',
    },
    button: { fr: 'Me connecter', en: 'Sign in' },
    footer: {
      fr: 'Tu n’as pas demandé à te connecter ? Tu peux ignorer cet e-mail.',
      en: 'Didn’t ask to sign in? You can ignore this email.',
    },
    action: 'link',
  },
  invite: {
    subject: { fr: 'Invitation AnyChess', en: 'AnyChess invitation' },
    title: { fr: 'Tu es invité sur AnyChess', en: 'You’re invited to AnyChess' },
    body: {
      fr: 'Accepte l’invitation pour activer ton compte AnyChess.',
      en: 'Accept the invitation to activate your AnyChess account.',
    },
    button: { fr: 'Accepter l’invitation', en: 'Accept the invitation' },
    footer: {
      fr: 'Tu n’attendais pas cette invitation ? Tu peux ignorer cet e-mail.',
      en: 'Weren’t expecting this invitation? You can ignore this email.',
    },
    action: 'link',
  },
  reauthentication: {
    subject: {
      fr: 'Confirme que c’est bien toi — AnyChess',
      en: 'Confirm it’s you — AnyChess',
    },
    title: { fr: 'Confirmation de sécurité', en: 'Security check' },
    body: {
      fr: 'Saisis ce code dans AnyChess pour confirmer qu’il s’agit bien de toi.',
      en: 'Enter this code in AnyChess to confirm it’s you.',
    },
    button: { fr: '', en: '' },
    footer: {
      fr: 'Tu n’es pas à l’origine de cette demande ? Tu peux ignorer cet e-mail.',
      en: 'Didn’t request this? You can ignore this email.',
    },
    action: 'code',
  },
};

function block(copy, action) {
  const button =
    action === 'code'
      ? `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:28px;line-height:1.3;font-weight:700;letter-spacing:0.12em;color:#F5A623;">{{ .Token }}</p>`
      : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
            <tr>
              <td bgcolor="#F5A623" style="border-radius:12px;background:#F5A623;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 22px;font-family:Arial,sans-serif;font-size:16px;line-height:1.2;font-weight:700;color:#0B1728;text-decoration:none;">${copy.button}</a>
              </td>
            </tr>
          </table>
          <p class="muted" style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#8FB0CC;">
            ${copy.linkHint}<br>{{ .ConfirmationURL }}
          </p>`;
  return `<p class="text" style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:0.04em;color:#F5A623;">AnyChess</p>
          <img src="${LOGO_URL}" width="220" alt="AnyChess" style="display:block;width:220px;max-width:100%;height:auto;margin:0 0 16px;border:0;">
          <h1 class="text" style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:22px;line-height:1.3;color:#DCE8F5;">${copy.title}</h1>
          <p class="text" style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#DCE8F5;">${copy.body}</p>
          ${button}
          <p class="muted" style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#8FB0CC;">${copy.footer}</p>`;
}

export function renderAuthEmail(kind) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`Unknown auth email: ${kind}`);
  const fr = {
    ...spec,
    title: spec.title.fr,
    body: spec.body.fr,
    button: spec.button.fr,
    footer: spec.footer.fr,
    linkHint: 'Si le bouton ne s’ouvre pas, copie ce lien dans ton navigateur :',
  };
  const en = {
    ...spec,
    title: spec.title.en,
    body: spec.body.en,
    button: spec.button.en,
    footer: spec.footer.en,
    linkHint: 'If the button does not open, copy this link into your browser:',
  };
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>AnyChess</title>
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .bg { background: #0B1728 !important; }
      .card { background: #102040 !important; }
      .text { color: #DCE8F5 !important; }
      .muted { color: #8FB0CC !important; }
    }
    [data-ogsc] .text { color: #DCE8F5 !important; }
    [data-ogsc] .muted { color: #8FB0CC !important; }
    [data-ogsb] .bg { background: #0B1728 !important; }
    [data-ogsb] .card { background: #102040 !important; }
  </style>
</head>
<body class="bg" style="margin:0;padding:0;background:#0B1728;">
  <div style="display:none;max-height:0;overflow:hidden;color:#0B1728;">AnyChess</div>
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0B1728" style="background:#0B1728;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" bgcolor="#102040" style="max-width:480px;background:#102040;border-radius:20px;border:1px solid #1C3558;">
          <tr>
            <td style="padding:28px 24px;">
              {{ if eq .Data.language "en" }}
              ${block(en, spec.action)}
              {{ else }}
              ${block(fr, spec.action)}
              {{ end }}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  const subject = `{{ if eq .Data.language "en" }}${spec.subject.en}{{ else }}${spec.subject.fr}{{ end }}`;
  return { subject, html };
}

export const AUTH_EMAIL_KINDS = Object.keys(KINDS);
