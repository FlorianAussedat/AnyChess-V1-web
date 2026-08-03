import React from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { BrandAssets } from '@/constants/BrandAssets';

/**
 * Global sound toggle using Major Update brand artwork.
 */
export function SoundToggle() {
  const colors = useColors();
  const { soundEnabled, toggleSound } = useAudioSettings();

  return (
    <Pressable
      onPress={() => {
        toggleSound().catch(() => {});
      }}
      hitSlop={10}
      testID="sound-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: soundEnabled }}
      accessibilityLabel={soundEnabled ? 'Couper le son' : 'Activer le son'}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Image
        source={soundEnabled ? BrandAssets.toggles.soundOn : BrandAssets.toggles.soundOff}
        style={styles.icon}
        resizeMode="contain"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 30,
    height: 30,
  },
});
