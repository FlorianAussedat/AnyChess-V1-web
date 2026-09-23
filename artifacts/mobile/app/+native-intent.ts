/**
 * Expo Router native intent — DEV deep-link rewrite only.
 * Does not change product routes or the Stockfish transport.
 */
import { rewriteDevSystemPath } from '@/lib/app/devDeepLink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return rewriteDevSystemPath(path);
  } catch {
    return path;
  }
}
