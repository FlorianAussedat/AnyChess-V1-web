import { useCallback, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Android runs exactly the visible header's callback, including editor/session guards. */
export function useHeaderHardwareBack(onBack: () => void): void {
  const callback = useRef(onBack);
  callback.current = onBack;
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      callback.current();
      return true;
    });
    return () => subscription.remove();
  }, []));
}
