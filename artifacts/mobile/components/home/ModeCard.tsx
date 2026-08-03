/**
 * Reusable home menu mode card — premium dark card with integrated knight art.
 * Illustration sits in the card (no white square container).
 * Portrait v1 mascot PNGs are oversized in a clipped right slot so the visible
 * figure fills ~120–150px without editing the PNG files.
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
  // ~38% for mascot column on typical phones; keep text from running under it.
  const mascotSlotWidth = Math.round(
    Math.min(
      DesignTokens.modeIllustrationWidth,
      Math.max(128, cardInnerWidth * 0.38),
    ),
  );
  // Portrait assets (≈2:3): render taller than the card so visible content fills the slot.
  const mascotImgWidth = Math.round(mascotSlotWidth * 1.15);
  const mascotImgHeight = Math.round(mascotImgWidth * 1.35);

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
      <View style={[styles.textCol, { maxWidth: '60%', paddingRight: 8 }]}>
        <View style={styles.titleRow}>
          <Ionicons
            name={iconName as ComponentProps<typeof Ionicons>['name']}
            size={18}
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
            marginRight: -10,
            marginBottom: -18,
          }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={styles.chevron} pointerEvents="none">
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
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
    paddingVertical: DesignTokens.spacing.md,
    paddingLeft: DesignTokens.spacing.lg,
    paddingRight: DesignTokens.spacing.sm,
    justifyContent: 'center',
  },
  textCol: {
    zIndex: 2,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thematicIcon: {
    marginTop: 1,
  },
  title: {
    flexShrink: 1,
    fontSize: DesignTokens.typography.cardTitle,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    lineHeight: 28,
  },
  description: {
    fontSize: DesignTokens.typography.caption,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    paddingRight: 4,
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
    right: 10,
    top: '50%',
    marginTop: -9,
    zIndex: 3,
  },
});
