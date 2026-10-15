export type ConfirmPageOutcome =
  | 'verify'
  | 'expired'
  | 'invalid'
  | 'other'
  | 'idle'
  | 'recover'
  | 'unavailable';

export type ConfirmLanguage = 'fr' | 'en';
export type AuthClientVariant = 'app' | 'dev';

export const CONFIRM_COPY = {
  fr: {
    confirmedTitle: 'Adresse e-mail confirmée !',
    confirmed: 'Tu peux retourner dans AnyChess et te connecter à ton compte.',
    expiredTitle: 'Ce lien n’est plus valable',
    expired: 'Retourne dans AnyChess pour demander un nouvel e-mail de confirmation.',
    idleTitle: 'Cette page n’a pas confirmé ton adresse',
    idle: 'Ouvre le lien reçu par e-mail pour l’activer. Tu peux aussi retourner dans AnyChess.',
    unavailableTitle: 'Vérifie ta connexion dans AnyChess',
    unavailable:
      'Nous ne pouvons pas confirmer le résultat depuis cette page. Retourne dans l’application et essaie de te connecter.',
    checkingTitle: 'AnyChess',
    checking: 'Vérification du lien…',
    otherTitle: 'Retourne dans AnyChess',
    other: 'Ce lien ne confirme pas l’adresse e-mail. Reviens dans l’application pour continuer.',
    open: 'Ouvrir AnyChess',
    alt: 'Tu peux aussi fermer cette page et ouvrir l’application.',
    recoverTitle: 'Nouveau mot de passe',
    recoverPrompt: 'Choisis un nouveau mot de passe pour ton compte AnyChess.',
    recoverSavedTitle: 'Mot de passe mis à jour',
    recoverSaved: 'Tu peux retourner dans AnyChess et te connecter avec ce mot de passe.',
    recoverLabel: 'Nouveau mot de passe',
    recoverLabel2: 'Confirme le mot de passe',
    recoverSubmit: 'Enregistrer le mot de passe',
    recoverMismatch: 'Les deux mots de passe ne correspondent pas.',
    recoverShort: 'Le mot de passe doit contenir au moins 6 caractères.',
    recoverFailedTitle: 'Ce lien n’est plus valable',
    recoverFailed:
      'Ce lien ne permet plus de changer le mot de passe. Retourne dans AnyChess et redemande un e-mail.',
    recoverNetwork:
      'Nous ne pouvons pas enregistrer le mot de passe depuis cette page. Réessaie, ou retourne dans AnyChess.',
  },
  en: {
    confirmedTitle: 'Email address confirmed!',
    confirmed: 'You can return to AnyChess and sign in to your account.',
    expiredTitle: 'This link is no longer valid',
    expired: 'Go back to AnyChess to request a new confirmation email.',
    idleTitle: 'This page has not confirmed your address',
    idle: 'Open the link from the email to activate it. You can also return to AnyChess.',
    unavailableTitle: 'Check your connection in AnyChess',
    unavailable:
      'We can’t confirm the result from this page. Go back to the app and try to sign in.',
    checkingTitle: 'AnyChess',
    checking: 'Checking the link…',
    otherTitle: 'Return to AnyChess',
    other: 'This link does not confirm the email address. Go back to the app to continue.',
    open: 'Open AnyChess',
    alt: 'You can also close this page and open the app.',
    recoverTitle: 'New password',
    recoverPrompt: 'Choose a new password for your AnyChess account.',
    recoverSavedTitle: 'Password updated',
    recoverSaved: 'You can return to AnyChess and sign in with this password.',
    recoverLabel: 'New password',
    recoverLabel2: 'Confirm the password',
    recoverSubmit: 'Save password',
    recoverMismatch: 'The two passwords do not match.',
    recoverShort: 'The password must contain at least 6 characters.',
    recoverFailedTitle: 'This link is no longer valid',
    recoverFailed: 'This link can no longer change the password. Go back to AnyChess and request a new email.',
    recoverNetwork: 'We can’t save the password from this page. Try again, or return to AnyChess.',
  },
} as const;

/**
 * Readable fallback. The free `*.supabase.co` domain rewrites HTML to text/plain,
 * so this is what a browser can actually show. It must not claim the address
 * is confirmed: the fragment token never reaches this function.
 */
export function plainFallback(language: ConfirmLanguage): string {
  if (language === 'en') {
    return `AnyChess

Check your connection in AnyChess

We can’t confirm the result from this page. Go back to the app and try to sign in.

If the link has expired, request a new confirmation email in AnyChess.

You can also close this page and open the app.
`;
  }
  return `AnyChess

Vérifie ta connexion dans AnyChess

Nous ne pouvons pas confirmer le résultat depuis cette page. Retourne dans l’application et essaie de te connecter.

Si le lien a expiré, demande un nouvel e-mail de confirmation dans AnyChess.

Tu peux aussi fermer cette page et ouvrir l’application.
`;
}

export const PLAIN_FALLBACK = plainFallback('fr');

/** First language tag only. French is the product default. */
export function languageFromAccept(header: string | null | undefined): ConfirmLanguage {
  const first = (header ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  const code = first.split(';')[0]?.trim().split('-')[0] ?? '';
  return code === 'en' ? 'en' : 'fr';
}

/**
 * Plain JS embedded in the confirmation page. One source, evaluated in tests
 * and in the browser.
 *
 * Opening the page, or a `success=true` parameter, is not confirmation.
 * The only success path is a signup token whose user has `email_confirmed_at`.
 *
 * App links open the Utilisateur screen of the installed variant:
 * `client=dev` opens AnyChess Dev (`exp+mobile://utilisateur`, package
 * `com.anychess.app`); every other value opens standalone AnyChess
 * (`anychess://utilisateur`, package `com.anychess.standalone`). The Android
 * package disambiguates when both are installed. A scheme or URL supplied
 * in the query is ignored. Tokens are never copied into the app link.
 */
export const INTERPRET_SOURCE = `
function interpretConfirmationLocation(search, hash) {
  var query = new URLSearchParams(search.charAt(0) === '?' ? search.slice(1) : search);
  var rawHash = hash.charAt(0) === '#' ? hash.slice(1) : hash;
  var fragment = new URLSearchParams(rawHash);
  var error = query.get('error') || fragment.get('error') || '';
  var errorCode = (query.get('error_code') || fragment.get('error_code') || '').toLowerCase();
  var description = query.get('error_description') || fragment.get('error_description') || '';
  var access = query.get('access_token') || fragment.get('access_token') || '';
  var type = (query.get('type') || fragment.get('type') || '').toLowerCase();
  if (error || errorCode) {
    if (error === 'server_error' || errorCode === 'unexpected_failure' || errorCode === 'request_timeout') {
      return 'unavailable';
    }
    if (errorCode === 'otp_expired' || errorCode === 'otp_disabled' || /expired|invalid/i.test(description)) {
      return 'expired';
    }
    return 'invalid';
  }
  if (access && type === 'recovery') return 'recover';
  if (type === 'recovery' || type === 'magiclink' || type === 'invite' || type === 'email_change') {
    return 'other';
  }
  if (query.get('code') && !access) return 'unavailable';
  if (access && (type === 'signup' || type === 'email')) return 'verify';
  return 'idle';
}
function userEmailIsConfirmed(body) {
  if (!body || typeof body !== 'object') return false;
  var row = body.user && typeof body.user === 'object' ? body.user : body;
  var stamp = row.email_confirmed_at || row.confirmed_at;
  return typeof stamp === 'string' && stamp.trim().length > 0;
}
function pageLanguage(search, navigatorLanguage) {
  var query = new URLSearchParams(search.charAt(0) === '?' ? search.slice(1) : search);
  var value = (query.get('lang') || '').toLowerCase();
  if (value === 'fr' || value === 'en') return value;
  var nav = (navigatorLanguage || '').toLowerCase();
  if (nav.indexOf('en') === 0) return 'en';
  return 'fr';
}
function pageClient(search) {
  var query = new URLSearchParams(search.charAt(0) === '?' ? search.slice(1) : search);
  var value = (query.get('client') || '').toLowerCase();
  if (value === 'dev') return 'dev';
  return 'app';
}
function appOpenHref(client, userAgent) {
  var android = /Android/i.test(userAgent || '');
  if (client === 'dev') {
    return android
      ? 'intent://utilisateur#Intent;scheme=exp+mobile;package=com.anychess.app;end'
      : 'exp+mobile://utilisateur';
  }
  return android
    ? 'intent://utilisateur#Intent;scheme=anychess;package=com.anychess.standalone;end'
    : 'anychess://utilisateur';
}
`;

type InterpretFns = {
  interpretConfirmationLocation: (search: string, hash: string) => ConfirmPageOutcome;
  userEmailIsConfirmed: (body: unknown) => boolean;
  pageLanguage: (search: string, navigatorLanguage: string) => ConfirmLanguage;
  pageClient: (search: string) => AuthClientVariant;
  appOpenHref: (client: string, userAgent: string) => string;
};

let fns: InterpretFns | null = null;

function load(): InterpretFns {
  if (!fns) {
    const factory = new Function(
      `${INTERPRET_SOURCE}; return { interpretConfirmationLocation, userEmailIsConfirmed, pageLanguage, pageClient, appOpenHref };`,
    );
    fns = factory() as InterpretFns;
  }
  return fns;
}

export function interpretConfirmationLocation(search: string, hash: string): ConfirmPageOutcome {
  return load().interpretConfirmationLocation(search, hash);
}

export function userEmailIsConfirmed(body: unknown): boolean {
  return load().userEmailIsConfirmed(body);
}

export function pageLanguage(search: string, navigatorLanguage = ''): ConfirmLanguage {
  return load().pageLanguage(search, navigatorLanguage);
}

export function pageClient(search: string): AuthClientVariant {
  return load().pageClient(search);
}

export function appOpenHref(client: string, userAgent = ''): string {
  return load().appOpenHref(client, userAgent);
}
