/**
 * Rewrite incoming native URLs so Expo Router lands on DEV routes.
 *
 * `mobile://dev/stockfish-uci` is parsed as host=`dev` + path=`/stockfish-uci`,
 * which does not match the file route `/dev/stockfish-uci`. Used by
 * `app/+native-intent.ts` only. Each incoming URL is classified once.
 *
 * A development-build connection
 * (`exp+mobile://expo-development-client/?url=https://<tunnel>`) is the Metro
 * origin, not an in-app route. Returning that URL makes the dev client load
 * the script again. Returning `/` would also reset an already open session.
 * Those connections are dropped from navigation (`''`).
 *
 * Account confirmation and password recovery links are returned unchanged.
 *
 * Expo Router 6 still logs "linking in multiple places" when Android remounts
 * the root. That warning is not hidden.
 * Reference: https://github.com/expo/expo/pull/42644
 * (issue https://github.com/expo/expo/issues/42500).
 * Affected here: expo ~54.0.27, expo-router ~6.0.17 (SDK 54).
 * The Android silence landed on SDK 55+ and is not in expo-router 6.0.x.
 * `plugins/withAndroidSingleTask.js` is the native workaround; it applies
 * only after a new development build.
 */
export const DEV_STOCKFISH_UCI_PATH = '/dev/stockfish-uci';
export const DEV_SITEMAP_PATH = '/_sitemap';
/** Where « Ouvrir AnyChess » lands, cold or with the app already open. */
export const ACCOUNT_RETURN_PATH = '/utilisateur';

export const EXPO_ANDROID_LINKING_BUG = {
  issue: 'https://github.com/expo/expo/issues/42500',
  pullRequest: 'https://github.com/expo/expo/pull/42644',
  affectedExpo: '~54.0.27',
  affectedExpoRouter: '~6.0.17',
  fixedIn: 'SDK 55+ (not backported to expo-router 6.0.x)',
} as const;

export type LinkingDecision =
  | { action: 'pass-through' }
  | { action: 'preserve-auth-link' }
  | { action: 'rewrite-dev-route'; to: string }
  | { action: 'preserve-app-path'; to: string }
  | { action: 'filter-dev-client-connection' }
  | { action: 'rewrite-account-return'; to: string };

const diagnostics: LinkingDecision[] = [];
let lastDecision: LinkingDecision = { action: 'pass-through' };

export function lastLinkingDecision(): LinkingDecision {
  return lastDecision;
}

export function linkingDiagnostics(): readonly LinkingDecision[] {
  return diagnostics;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function devRouteIn(value: string): string | null {
  if (/stockfish-uci/i.test(value)) return DEV_STOCKFISH_UCI_PATH;
  if (/(^|[/?#])_sitemap(\b|\/|$)/i.test(value)) return DEV_SITEMAP_PATH;
  return null;
}

/** Signup confirmation and password recovery. Not a Metro connection. */
export function isAuthLink(value: string): boolean {
  if (!value) return false;
  return (
    /\/auth\/confirm(?:[/?#]|$)/i.test(value) ||
    /\/functions\/v1\/auth-confirm(?:[/?#]|$)/i.test(value) ||
    /\/auth\/v1\/verify(?:[/?#]|$)/i.test(value) ||
    /\/auth\/v1\/recover(?:[/?#]|$)/i.test(value) ||
    /[?#&]type=(?:signup|recovery|email_change)(?:&|#|$)/i.test(value) ||
    /[?#&]error_code=otp_expired(?:&|#|$)/i.test(value)
  );
}

function devClientInnerUrl(value: string): string | null {
  if (!/expo-development-client/i.test(value)) return null;
  try {
    return new URL(value).searchParams.get('url');
  } catch {
    return null;
  }
}

function isPackagerUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  const packager =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '10.0.2.2' ||
    host.endsWith('.exp.direct') ||
    host.endsWith('.ngrok.io') ||
    host.endsWith('.ngrok-free.app') ||
    host.endsWith('.trycloudflare.com') ||
    (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) &&
      (url.port === '8081' || url.port === '8080' || url.port === '19000' || url.port === '19006'));
  return packager ? url : null;
}

const METRO_ASSET =
  /(?:^|\/)[^/]*\.bundle(?:\?|$)|\/_expo\/|\/\.expo\/|\/node_modules\/|^\/assets\//;

const ACCOUNT_SCHEMES = new Set(['exp+mobile', 'mobile', 'anychess', 'intent']);

/**
 * The confirmation button uses host `open` on the published page, and
 * `utilisateur` once that page is regenerated. Both open Utilisateur.
 * A Metro connection and product routes such as `/openings` stay untouched.
 */
function accountReturnTarget(value: string): string | null {
  const bare = value.trim().replace(/\/+$/, '');
  if (
    bare === '/open' ||
    bare === 'open' ||
    bare === '/utilisateur' ||
    bare === 'utilisateur'
  ) {
    return ACCOUNT_RETURN_PATH;
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const scheme = url.protocol.replace(/:$/, '').toLowerCase();
  if (!ACCOUNT_SCHEMES.has(scheme)) return null;
  const host = url.hostname.toLowerCase();
  if (host === 'expo-development-client') return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (host === 'open' || host === 'utilisateur') return ACCOUNT_RETURN_PATH;
  if (
    host === '' &&
    path === '' &&
    !url.search &&
    (scheme === 'exp+mobile' || scheme === 'anychess')
  ) {
    return ACCOUNT_RETURN_PATH;
  }
  return null;
}

function decide(decision: LinkingDecision, detail: string): LinkingDecision {
  lastDecision = decision;
  diagnostics.push(decision);
  const dev = typeof __DEV__ === 'undefined' || __DEV__;
  if (dev && decision.action !== 'pass-through') {
    console.warn(
      `[AnyChess linking] ${decision.action}: ${detail}. ` +
        `Separate Expo Android bug ${EXPO_ANDROID_LINKING_BUG.pullRequest} ` +
        `(${EXPO_ANDROID_LINKING_BUG.affectedExpoRouter}, ${EXPO_ANDROID_LINKING_BUG.affectedExpo}; ` +
        `${EXPO_ANDROID_LINKING_BUG.fixedIn}). LogBox is not filtered.`,
    );
  }
  return decision;
}

/**
 * @param initial `false` when the URL arrives after launch.
 * @returns a route, the original auth/product URL, or `''` to leave navigation unchanged.
 */
export function rewriteDevSystemPath(path: string, initial = true): string {
  if (typeof path !== 'string' || path.length === 0) {
    decide({ action: 'pass-through' }, 'empty');
    return path;
  }
  const trimmed = path.trim();
  const innerRaw = devClientInnerUrl(trimmed);
  const decoded = safeDecode(trimmed);
  const candidate = innerRaw != null ? safeDecode(innerRaw) : decoded;

  if (innerRaw == null && isAuthLink(decoded)) {
    decide({ action: 'preserve-auth-link' }, 'confirmation or password recovery');
    return path;
  }

  if (innerRaw != null && isAuthLink(candidate)) {
    decide({ action: 'preserve-auth-link' }, 'auth link nested in the dev client url');
    return candidate;
  }

  const devRoute = devRouteIn(candidate);
  if (devRoute) {
    decide({ action: 'rewrite-dev-route', to: devRoute }, 'dev file route');
    return devRoute;
  }

  const accountReturn = accountReturnTarget(decoded);
  if (accountReturn) {
    decide(
      { action: 'rewrite-account-return', to: accountReturn },
      initial ? 'cold start opens Utilisateur' : 'open session opens Utilisateur',
    );
    return accountReturn;
  }

  const packager = isPackagerUrl(candidate);
  if (packager && (innerRaw != null || isPackagerUrl(decoded))) {
    const pathname = packager.pathname || '/';
    const suffix = `${packager.search}${packager.hash}`;
    if (pathname === '/' || pathname === '' || METRO_ASSET.test(`${pathname}${suffix}`)) {
      decide(
        { action: 'filter-dev-client-connection' },
        initial
          ? 'launch connection is not an app route'
          : 'open session stays on its current route',
      );
      return '';
    }
    const appPath = `${pathname}${suffix}`;
    decide({ action: 'preserve-app-path', to: appPath }, 'app path on the bundler origin');
    return appPath;
  }

  decide({ action: 'pass-through' }, 'unchanged');
  return path;
}
