import React from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { BrandAssets } from '@/constants/BrandAssets';

interface Props {
  visible: boolean;
  onToggle: () => void;
}

/**
 * Board show/hide control using Major Update brand artwork.
 */
export function BoardVisibilityToggle({ visible, onToggle }: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      testID="board-visibility-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: visible }}
      accessibilityLabel={visible ? 'Masquer l’échiquier' : 'Afficher l’échiquier'}
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
        source={visible ? BrandAssets.toggles.boardOn : BrandAssets.toggles.boardOff}
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
