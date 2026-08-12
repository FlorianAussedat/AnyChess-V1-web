/**
 * Shared pressable for brand toggle PNGs (board / coords / speaker).
 * Assets carry their own ON/OFF styling — no tint or colored chrome.
 */
import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  type ImageSourcePropType,
} from 'react-native';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  active: boolean;
  onSource: ImageSourcePropType;
  offSource: ImageSourcePropType;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
  /** Outer hit target (default matches board toggles). */
  size?: number;
  /** Inner image edge length. */
  iconSize?: number;
};

export function BrandAssetToggle({
  active,
  onSource,
  offSource,
  onPress,
  testID,
  accessibilityLabel,
  size = DesignTokens.headerIconButton + 4,
  iconSize = 28,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.hit,
        { width: size, height: size, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Image
        source={active ? onSource : offSource}
        style={{ width: iconSize, height: iconSize }}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
