/**
 * Rewrite incoming native URLs so Expo Router lands on DEV routes.
 *
 * `mobile://dev/stockfish-uci` is parsed as host=`dev` + path=`/stockfish-uci`,
 * which does not match the file route `/dev/stockfish-uci` and falls through
 * to Accueil. Used by `app/+native-intent.ts` only.
 *
 * A development-build connection URL
 * (`exp+mobile://expo-development-client/?url=http://<metro>:8081`) is not an
 * in-app route. Returning that Metro URL makes the router treat the bundler
 * as a deep link and the dev client tries to load the script a second time.
 */
export const DEV_STOCKFISH_UCI_PATH = '/dev/stockfish-uci';
export const DEV_SITEMAP_PATH = '/_sitemap';

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

function devClientInnerUrl(value: string): string | null {
  if (!/expo-development-client/i.test(value)) return null;
  try {
    return new URL(value).searchParams.get('url');
  } catch {
    return null;
  }
}

function appPathFromBundlerUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const pathname = url.pathname || '/';
  if (pathname === '/' || pathname === '') return null;
  return devRouteIn(pathname) ?? `${pathname}${url.search}${url.hash}`;
}

/**
 * @param initial `false` when the URL arrives after launch. A plain Metro
 * connection must not reset the screen the user is already on.
 * @returns a route, or `''` to leave the current route unchanged.
 */
export function rewriteDevSystemPath(path: string, initial = true): string {
  if (typeof path !== 'string' || path.length === 0) return path;
  const decoded = safeDecode(path.trim());
  const inner = devClientInnerUrl(decoded);
  const candidate = inner ? safeDecode(inner) : decoded;

  const devRoute = devRouteIn(candidate);
  if (devRoute) return devRoute;

  if (inner != null || /^https?:\/\//i.test(decoded)) {
    const embedded = appPathFromBundlerUrl(candidate);
    if (embedded) return embedded;
    return initial ? '/' : '';
  }

  return path;
}
