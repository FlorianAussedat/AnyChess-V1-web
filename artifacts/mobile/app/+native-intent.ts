/**
 * Expo Router native intent — DEV deep-link rewrite only.
 * Does not change product routes, auth links, or the Stockfish transport.
 *
 * A Metro / dev-client connection is not forwarded and does not reset an
 * open session. Confirmation and password-recovery URLs pass through.
 * « Ouvrir AnyChess » (`open` or `utilisateur`) lands on /utilisateur.
 */
import { rewriteDevSystemPath } from '@/lib/app/devDeepLink';

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    return rewriteDevSystemPath(path, initial);
  } catch {
    return path;
  }
}
