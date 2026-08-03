/**
 * Reusable home menu mode card — premium dark card with integrated knight art.
 * Illustration sits in the card (no white square container).
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
  const narrow = width < 360;
  const illustrationWidth = narrow
    ? DesignTokens.modeIllustrationWidth - 16
    : DesignTokens.modeIllustrationWidth;

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
      <View style={[styles.textCol, { paddingRight: illustrationWidth - 8 }]}>
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
        style={[styles.illustrationSlot, { width: illustrationWidth }]}
        pointerEvents="none"
      >
        <Image
          source={illustration}
          style={styles.illustration}
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
    gap: 6,
    maxWidth: '72%',
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
    flex: 1,
    fontSize: DesignTokens.typography.cardTitle,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: DesignTokens.typography.caption,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
    paddingRight: 4,
  },
  illustrationSlot: {
    position: 'absolute',
    right: 4,
    bottom: -6,
    top: -4,
    zIndex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  chevron: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -9,
    zIndex: 3,
  },
});
