import { useEffect } from 'react';

export const navigationCalls: { method: string; href?: unknown }[] = [];

export function useRouter() {
  return {
    canGoBack() { return false; },
    push(href: unknown) { navigationCalls.push({ method: 'push', href }); },
    replace(href: unknown) { navigationCalls.push({ method: 'replace', href }); },
    back() { navigationCalls.push({ method: 'back' }); },
  };
}

export function usePathname() { return '/'; }
export function useFocusEffect(effect: () => void | (() => void)) { useEffect(effect, [effect]); }

export function useNavigation() { return { addListener() { return () => {}; } }; }
