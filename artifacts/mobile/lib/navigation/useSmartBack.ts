/** History first; an explicit or route-aware fallback for direct links. */
import { useCallback } from 'react';
import { usePathname, useRouter, type Href } from 'expo-router';
import { backToPrevious } from './routes';

export function useSmartBack(fallbackHref?: Href) {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(() => {
    backToPrevious(router, pathname, fallbackHref);
  }, [router, pathname, fallbackHref]);
}
