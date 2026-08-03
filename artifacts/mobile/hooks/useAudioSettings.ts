import { useCallback, useEffect, useState } from 'react';
import { audioSettings } from '@/services/AudioSettings';
import { speechService } from '@/services/SpeechService';

/** React mirror of the global TTS voice-mute preference (SFX unaffected). */
export function useAudioSettings() {
  const [voiceEnabled, setVoiceEnabledState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    audioSettings.ensureLoaded().then(() => {
      if (!cancelled) {
        setVoiceEnabledState(audioSettings.isVoiceEnabled());
        setReady(true);
      }
    });
    const unsub = audioSettings.onChange((enabled) => {
      setVoiceEnabledState(enabled);
      if (!enabled) speechService.stop();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const toggleVoice = useCallback(async () => {
    const next = await audioSettings.toggleVoice();
    if (!next) speechService.stop();
    return next;
  }, []);

  const setVoiceEnabled = useCallback(async (enabled: boolean) => {
    await audioSettings.setVoiceEnabled(enabled);
    if (!enabled) speechService.stop();
  }, []);

  // Back-compat aliases used by older screens during migration
  const soundEnabled = voiceEnabled;
  const toggleSound = toggleVoice;
  const setSoundEnabled = setVoiceEnabled;

  return {
    voiceEnabled,
    soundEnabled,
    ready,
    toggleVoice,
    toggleSound,
    setVoiceEnabled,
    setSoundEnabled,
  };
}
