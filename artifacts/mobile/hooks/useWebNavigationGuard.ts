import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';

/** Browser history must pass through the same confirmation as the visible Back control. */
export function useWebNavigationGuard(enabled: boolean, onAttempt: () => void, scope?: string) {
  const navigation = useNavigation();
  const latest = useRef({ enabled, onAttempt });
  latest.current = { enabled, onAttempt };
  const allowed = useRef(false);
  useEffect(() => { allowed.current = false; }, [enabled, scope]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web') return;
    return navigation.addListener('beforeRemove', event => {
      if (!latest.current.enabled || allowed.current) return;
      event.preventDefault();
      latest.current.onAttempt();
    });
  }, [navigation]));
  return useCallback(() => { allowed.current = true; }, []);
}
