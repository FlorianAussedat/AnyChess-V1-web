import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_VOICE_SPEED } from '@/lib/continueLine/voiceSpeed';
import { voiceSpeedSettings } from '@/lib/preferences/VoiceSpeedSettings';

/** React mirror of the global default TTS voice speed preference. */
export function useDefaultVoiceSpeed() {
  const [speed, setSpeedState] = useState(DEFAULT_VOICE_SPEED);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    voiceSpeedSettings.ensureLoaded().then(() => {
      if (!cancelled) {
        setSpeedState(voiceSpeedSettings.getDefaultSpeed());
        setReady(true);
      }
    });
    const unsub = voiceSpeedSettings.onChange(setSpeedState);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const setDefaultSpeed = useCallback(async (next: number) => {
    return voiceSpeedSettings.setDefaultSpeed(next);
  }, []);

  return { speed, ready, setDefaultSpeed };
}
