import React from 'react';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandAssetToggle } from '@/components/BrandAssetToggle';
import { BrandAssets } from '@/constants/BrandAssets';

/**
 * Voice / speech mute toggle (TTS only).
 * Uses shared brand speaker (sound-on / sound-off) assets.
 * Does NOT mute validation/error SFX or haptics.
 */
export function SoundToggle() {
  const { t } = useTranslation();
  const { voiceEnabled, toggleVoice } = useAudioSettings();

  return (
    <BrandAssetToggle
      active={voiceEnabled}
      onSource={BrandAssets.toggles.speaker.on}
      offSource={BrandAssets.toggles.speaker.off}
      onPress={() => {
        toggleVoice().catch(() => {});
      }}
      testID="sound-toggle"
      accessibilityLabel={
        voiceEnabled ? t('a11y.voiceMute') : t('a11y.voiceUnmute')
      }
      size={42}
    />
  );
}
