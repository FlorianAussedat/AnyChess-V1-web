import React from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandAssets } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';

/**
 * Voice / speech mute toggle (TTS only).
 * Uses shared brand mic-on / mic-off assets.
 * Does NOT mute validation/error SFX or haptics.
 */
export function SoundToggle() {
  const colors = useColors();
  const { t } = useTranslation();
  const { voiceEnabled, toggleVoice } = useAudioSettings();

  return (
    <Pressable
      onPress={() => {
        toggleVoice().catch(() => {});
      }}
      hitSlop={10}
      testID="sound-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: voiceEnabled }}
      accessibilityLabel={
        voiceEnabled ? t('a11y.voiceMute') : t('a11y.voiceUnmute')
      }
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: voiceEnabled ? colors.primary : colors.card,
          borderColor: voiceEnabled ? colors.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Image
        source={
          voiceEnabled ? BrandAssets.toggles.micOn : BrandAssets.toggles.micOff
        }
        style={styles.icon}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 42,
    height: 42,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 28,
    height: 28,
  },
});
