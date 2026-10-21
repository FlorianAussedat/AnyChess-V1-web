import { useEffect } from 'react';

export function useRouter() {
  return {
    canGoBack() { return false; },
    push() {},
    replace() {},
    back() {},
  };
}

export function usePathname() { return '/'; }
export function useFocusEffect(effect: () => void | (() => void)) { useEffect(effect, [effect]); }

export function useNavigation() { return { addListener() { return () => {}; } }; }
