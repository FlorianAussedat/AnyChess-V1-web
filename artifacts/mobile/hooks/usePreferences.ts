import { useCallback, useEffect, useState } from 'react';
import {
  preferencesStore,
  type UserPreferences,
  type UserPreferencesPatch,
} from '@/lib/preferences';
import { speechService } from '@/services/SpeechService';

/**
 * React mirror of PreferencesStore.
 * `isPreferencesHydrated` is false until the first AsyncStorage load finishes.
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    preferencesStore.getPreferences(),
  );
  const [isPreferencesHydrated, setHydrated] = useState(() =>
    preferencesStore.isHydrated(),
  );

  useEffect(() => {
    let cancelled = false;
    preferencesStore.ensureLoaded().then((prefs) => {
      if (!cancelled) {
        setPreferences(prefs);
        setHydrated(true);
      }
    });
    const unsub = preferencesStore.onChange((prefs) => {
      setPreferences(prefs);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const updatePreferences = useCallback(async (patch: UserPreferencesPatch) => {
    const next = await preferencesStore.update(patch);
    if (patch.voiceEnabled === false) speechService.stop();
    return next;
  }, []);

  const resetPreferences = useCallback(async () => {
    return preferencesStore.resetPreferences();
  }, []);

  return {
    preferences,
    isPreferencesHydrated,
    updatePreferences,
    resetPreferences,
    language: preferences.language,
    chessNotation: preferences.chessNotation,
    voiceEnabled: preferences.voiceEnabled,
    coordinatesEnabled: preferences.coordinatesEnabled,
    voiceSpeed: preferences.voiceSpeed,
    dictationPace: preferences.dictationPace,
    visualProblemDifficulty: preferences.visualProblemDifficulty,
    blindProblemDifficulty: preferences.blindProblemDifficulty,
    chessInputMode: preferences.chessInputMode,
    stockfishStrengthBandId: preferences.stockfishStrengthBandId,
  };
}
