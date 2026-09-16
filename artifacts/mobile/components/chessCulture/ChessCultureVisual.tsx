/**
 * Optional Culture générale quiz image (offline, registry-backed).
 * Missing / unregistered imageId → render nothing (never crash).
 */
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { resolveChessCultureImageSource } from '@/lib/chessCulture/visualRegistry';
import type { ChessCulturePresentation } from '@/lib/chessCulture/types';

type Props = {
  presentation?: ChessCulturePresentation;
  testID?: string;
};

export function ChessCultureVisual({ presentation, testID = 'culture-visual' }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const imageId = presentation?.imageId;
  const source = resolveChessCultureImageSource(imageId);

  if (!source) return null;

  const fit = presentation?.imageFit === 'cover' ? 'cover' : 'contain';
  // Keep portraits compact so answer choices stay near the first viewport on phones.
  const maxWidth = Math.min(width - 36, fit === 'cover' ? 280 : 420);
  const maxHeight =
    fit === 'cover'
      ? Math.min(Math.round(maxWidth * 0.72), 200)
      : Math.min(Math.round(maxWidth * 0.85), 280);

  return (
    <View style={styles.wrap} testID={testID}>
      <View
        style={[
          styles.frame,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
            width: maxWidth,
            height: maxHeight,
          },
        ]}
      >
        <Image
          source={source}
          style={{ width: '100%', height: '100%' }}
          contentFit={fit}
          accessibilityLabel={presentation?.imageAlt ?? t('a11y.illustration')}
          recyclingKey={imageId}
        />
      </View>
      {presentation?.imageCaption ? (
        <Text style={[styles.caption, { color: colors.mutedForeground }]}>
          {presentation.imageCaption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  frame: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    overflow: 'hidden',
  },
  caption: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightRegular,
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 17,
  },
});
