import { useCallback, useEffect, useState } from 'react';
import { audioSettings } from '@/services/AudioSettings';
import { speechService } from '@/services/SpeechService';

/** React mirror of the global sound-enabled preference. */
export function useAudioSettings() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    audioSettings.ensureLoaded().then(() => {
      if (!cancelled) {
        setSoundEnabled(audioSettings.isSoundEnabled());
        setReady(true);
      }
    });
    const unsub = audioSettings.onChange((enabled) => {
      setSoundEnabled(enabled);
      if (!enabled) speechService.stop();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const toggleSound = useCallback(async () => {
    const next = await audioSettings.toggleSound();
    if (!next) speechService.stop();
    return next;
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    await audioSettings.setSoundEnabled(enabled);
    if (!enabled) speechService.stop();
  }, []);

  return { soundEnabled, ready, toggleSound, setSoundEnabled: setEnabled };
}
