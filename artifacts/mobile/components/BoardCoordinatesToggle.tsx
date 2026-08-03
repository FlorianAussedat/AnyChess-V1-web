import React from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { BrandAssets } from '@/constants/BrandAssets';

interface Props {
  visible: boolean;
  onToggle: () => void;
}

/**
 * Coordinates show/hide using Major Update brand artwork.
 */
export function BoardCoordinatesToggle({ visible, onToggle }: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      testID="board-coordinates-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: visible }}
      accessibilityLabel={
        visible ? 'Masquer les coordonnées' : 'Afficher les coordonnées'
      }
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
        source={visible ? BrandAssets.toggles.coordsOn : BrandAssets.toggles.coordsOff}
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
