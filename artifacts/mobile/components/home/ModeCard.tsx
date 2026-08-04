/**
 * Reusable home menu mode card — premium dark card with integrated knight art.
 * Illustration sits in the card (no white square container).
 *
 * v1 mascot PNGs place the subject in the upper-middle of a tall canvas with
 * empty black padding below. Layout aligns the measured artwork bounds to the
 * card BOTTOM-RIGHT so heads stay visible (slight bottom crop OK).
 */
import React, { type ComponentProps } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';
import { MASCOT_ART, artHeight } from '@/constants/brandArtBounds';
import type { ModeIconName } from '@/lib/app/mainModeCards';
import type { MainModeId } from '@/lib/app/modes';

/** ~2× previous thematic icon size (was 17). */
const THEMATIC_ICON_SIZE = 34;

export interface ModeCardProps {
  modeId: MainModeId;
  title: string;
  description: string;
  iconName: ModeIconName;
  illustration: ImageSourcePropType;
  onPress: () => void;
  testID?: string;
}

export function ModeCard({
  modeId,
  title,
  description,
  iconName,
  illustration,
  onPress,
  testID,
}: ModeCardProps) {
  const colors = useColors();
  const cardH = DesignTokens.modeCardHeight;
  const art = MASCOT_ART[modeId] ?? MASCOT_ART.classic;
  const aH = artHeight(art);

  // Fit full artwork (head → base) inside the card; slight bottom crop of the base.
  // Openings: keep horse head + book together (full measured bounds).
  const targetArtH = Math.round(cardH * 0.92);
  const bottomCrop = 10;
  const imgHeight = Math.round(targetArtH / aH);
  const imgWidth = Math.round(imgHeight * (1024 / 1536));

  // Anchor artwork bottom-right inside the card (not the raw PNG canvas).
  const imageBottom = -Math.round((1 - art.bottom) * imgHeight) - bottomCrop;
  const imageRight = -Math.round((1 - art.right) * imgWidth) - 6;

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: pressed ? colors.primary : colors.border,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.contentRow}>
        <Ionicons
          name={iconName as ComponentProps<typeof Ionicons>['name']}
          size={THEMATIC_ICON_SIZE}
          color={colors.primary}
          style={styles.thematicIcon}
          testID={testID ? `${testID}-icon` : undefined}
        />
        <View style={[styles.textCol, { maxWidth: '56%', paddingRight: 6 }]}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text
            style={[styles.description, { color: colors.mutedForeground }]}
            numberOfLines={3}
          >
            {description}
          </Text>
        </View>
      </View>

      <View style={styles.illustrationSlot} pointerEvents="none">
        <Image
          source={illustration}
          style={{
            position: 'absolute',
            right: imageRight,
            bottom: imageBottom,
            width: imgWidth,
            height: imgHeight,
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={`mode-${modeId}`}
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={styles.chevron} pointerEvents="none">
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: DesignTokens.modeCardHeight,
    minHeight: DesignTokens.modeCardMinHeight,
    borderRadius: DesignTokens.radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: DesignTokens.spacing.sm,
    paddingLeft: DesignTokens.spacing.lg,
    paddingRight: DesignTokens.spacing.sm,
    justifyContent: 'center',
  },
  contentRow: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  thematicIcon: {
    marginTop: 2,
  },
  textCol: {
    flexShrink: 1,
    gap: 6,
  },
  title: {
    flexShrink: 1,
    fontSize: DesignTokens.typography.cardTitle,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.15,
    textTransform: 'uppercase',
    lineHeight: 26,
  },
  description: {
    fontSize: DesignTokens.typography.caption,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    paddingRight: 2,
  },
  illustrationSlot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    top: 0,
    width: '48%',
    zIndex: 1,
    overflow: 'hidden',
  },
  chevron: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -8,
    zIndex: 3,
  },
});
