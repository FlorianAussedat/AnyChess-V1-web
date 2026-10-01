export type ConfirmPageOutcome = 'verify' | 'expired' | 'invalid' | 'other' | 'idle' | 'recover';

/**
 * Readable fallback. The free `*.supabase.co` domain rewrites HTML to text/plain,
 * so this is what a browser can actually show. It must not claim the address
 * is confirmed: that sentence lives in the HTML page, after /auth/v1/user.
 */
export const PLAIN_FALLBACK = `AnyChess

Cette page n’a pas confirmé ton adresse. Ouvre le lien reçu par e-mail pour l’activer.

Si tu viens d’utiliser ce lien, reviens te connecter dans AnyChess.

Si le lien a expiré ou n’est plus valable, demande un nouvel e-mail de confirmation dans l’application.

Un lien « mot de passe oublié » ne se règle pas ici : cette réponse texte ne peut pas enregistrer un nouveau mot de passe.
`;

export const CONFIRM_COPY = {
  confirmed: 'Adresse confirmée ! Tu peux maintenant te connecter à AnyChess.',
  expired:
    'Ce lien a expiré ou n’est plus valable. Retourne dans AnyChess et demande un nouvel e-mail de confirmation.',
  idle: 'Cette page n’a pas confirmé ton adresse. Ouvre le lien reçu par e-mail pour l’activer.',
  checking: 'Vérification du lien…',
  network: 'Problème de réseau. Réessaie d’ouvrir le lien de confirmation.',
  other: 'Ce lien ne confirme pas l’adresse e-mail. Reviens dans AnyChess pour continuer.',
  recoverPrompt: 'Choisis un nouveau mot de passe pour ton compte AnyChess.',
  recoverSaved: 'Mot de passe mis à jour. Tu peux maintenant te connecter à AnyChess.',
  recoverMismatch: 'Les deux mots de passe ne correspondent pas.',
  recoverShort: 'Le mot de passe doit contenir au moins 6 caractères.',
  recoverFailed:
    'Ce lien ne permet plus de changer le mot de passe. Retourne dans AnyChess et redemande un e-mail.',
  recoverNetwork: 'Problème de réseau. Réessaie d’enregistrer le mot de passe.',
} as const;

/**
 * Plain JS embedded in the confirmation page. One source, evaluated in tests
 * and in the browser. Opening the page without a verified signup token must
 * not report the address as confirmed.
 *
 * The Android build only registers the scheme `mobile` (no https App Link, no
 * auth route), so this page does not offer a return-to-app control.
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
    if (errorCode === 'otp_expired' || errorCode === 'otp_disabled' || /expired|invalid/i.test(description)) {
      return 'expired';
    }
    return 'invalid';
  }
  if (access && type === 'recovery') return 'recover';
  if (type === 'recovery' || type === 'magiclink' || type === 'invite' || type === 'email_change') {
    return 'other';
  }
  if (access && (type === 'signup' || type === 'email')) return 'verify';
  return 'idle';
}
function userEmailIsConfirmed(body) {
  if (!body || typeof body !== 'object') return false;
  var row = body.user && typeof body.user === 'object' ? body.user : body;
  var stamp = row.email_confirmed_at || row.confirmed_at;
  return typeof stamp === 'string' && stamp.trim().length > 0;
}
`;

type InterpretFns = {
  interpretConfirmationLocation: (search: string, hash: string) => ConfirmPageOutcome;
  userEmailIsConfirmed: (body: unknown) => boolean;
};

let fns: InterpretFns | null = null;

function load(): InterpretFns {
  if (!fns) {
    const factory = new Function(
      `${INTERPRET_SOURCE}; return { interpretConfirmationLocation, userEmailIsConfirmed };`,
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
