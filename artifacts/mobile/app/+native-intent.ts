/**
 * Expo Router native intent — DEV deep-link rewrite only.
 * Does not change product routes or the Stockfish transport.
 *
 * A plain development-client connection stays on the current screen after
 * launch. It is not forwarded as an http:// Metro URL.
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
