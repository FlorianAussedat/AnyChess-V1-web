/**
 * Rewrite incoming native URLs so Expo Router lands on DEV routes.
 *
 * `mobile://dev/stockfish-uci` is parsed as host=`dev` + path=`/stockfish-uci`,
 * which does not match the file route `/dev/stockfish-uci` and falls through
 * to Accueil. Used by `app/+native-intent.ts` only.
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

export function rewriteDevSystemPath(path: string): string {
  if (typeof path !== 'string' || path.length === 0) return path;
  const decoded = safeDecode(path.trim());

  if (/expo-development-client/i.test(decoded)) {
    try {
      const inner = new URL(decoded).searchParams.get('url');
      if (inner) return rewriteDevSystemPath(inner);
    } catch {
      /* fall through and scan the raw string */
    }
  }

  if (/stockfish-uci/i.test(decoded)) return DEV_STOCKFISH_UCI_PATH;
  if (/(^|[/?#])_sitemap(\b|\/|$)/i.test(decoded)) return DEV_SITEMAP_PATH;
  return path;
}
