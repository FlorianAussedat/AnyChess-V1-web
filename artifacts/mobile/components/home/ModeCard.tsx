/**
 * Reusable home menu mode card — premium dark card with integrated knight art.
 * Illustration sits in the card (no white square container).
 * Portrait v1 mascot PNGs are oversized in a clipped right slot so the visible
 * figure fills the right third (~40–42%) without editing the PNG files.
 */
import React, { type ComponentProps } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';
import type { ModeIconName } from '@/lib/app/mainModeCards';

export interface ModeCardProps {
  title: string;
  description: string;
  iconName: ModeIconName;
  illustration: ImageSourcePropType;
  onPress: () => void;
  testID?: string;
}

export function ModeCard({
  title,
  description,
  iconName,
  illustration,
  onPress,
  testID,
}: ModeCardProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const cardInnerWidth = width - DesignTokens.spacing.screenX * 2;
  // ~42% mascot column — matches reference right-third dominance.
  const mascotSlotWidth = Math.round(
    Math.min(
      DesignTokens.modeIllustrationWidth,
      Math.max(140, cardInnerWidth * 0.42),
    ),
  );
  // Portrait assets (≈2:3): render larger than the slot so the figure fills it.
  const mascotImgWidth = Math.round(mascotSlotWidth * 1.28);
  const mascotImgHeight = Math.round(mascotImgWidth * 1.38);

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
      <View style={[styles.textCol, { maxWidth: '56%', paddingRight: 6 }]}>
        <View style={styles.titleRow}>
          <Ionicons
            name={iconName as ComponentProps<typeof Ionicons>['name']}
            size={17}
            color={colors.primary}
            style={styles.thematicIcon}
          />
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
        <Text
          style={[styles.description, { color: colors.mutedForeground }]}
          numberOfLines={3}
        >
          {description}
        </Text>
      </View>

      <View
        style={[styles.illustrationSlot, { width: mascotSlotWidth }]}
        pointerEvents="none"
      >
        <Image
          source={illustration}
          style={{
            width: mascotImgWidth,
            height: mascotImgHeight,
            marginRight: -16,
            marginBottom: -28,
          }}
          resizeMode="contain"
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
  textCol: {
    zIndex: 2,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  thematicIcon: {
    marginTop: 1,
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
    zIndex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
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
