/**
 * Shared header + Android hardware back while a live session is on screen.
 * Cancel keeps the session. Confirm ends it (via confirmActiveSessionBack)
 * then runs the caller’s existing leave path.
 */
import { useCallback, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  confirmActiveSessionBack,
  type ActiveSessionBackKind,
} from '@/lib/activitySessions';

export function useActiveSessionBack(opts: {
  sessionActive: boolean;
  kind: ActiveSessionBackKind;
  activityId?: string;
  onLeave: () => void;
  onNavigateBack: () => void;
  /**
   * When true, Android back always matches the header (dedicated play routes).
   * Leave false in providers that also wrap hubs/settings.
   */
  captureHardwareBack?: boolean;
}): () => void {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const onBack = useCallback(() => {
    const current = optsRef.current;
    if (current.sessionActive) {
      confirmActiveSessionBack(current.kind, current.activityId, current.onLeave);
      return;
    }
    current.onNavigateBack();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        const current = optsRef.current;
        if (!current.sessionActive && !current.captureHardwareBack) return false;
        onBack();
        return true;
      });
      return () => sub.remove();
    }, [onBack]),
  );

  return onBack;
}
