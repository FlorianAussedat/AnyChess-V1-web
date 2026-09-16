/**
 * Smart back navigation — fallback when history is empty.
 */
import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

export function useSmartBack(fallbackHref: Href) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackHref);
    }
  }, [router, fallbackHref]);
}
