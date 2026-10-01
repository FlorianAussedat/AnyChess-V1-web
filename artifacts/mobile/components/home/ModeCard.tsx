/**
 * Reusable home menu mode card — premium dark card with integrated knight art.
 *
 * Text and mascot live in separate columns so the knight never covers the
 * title or explanation. The card grows with the copy; descriptions are not
 * ellipsized.
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
import {
  MASCOT_ART,
  MODE_CARD_MASCOT_SLOT,
  containArtInSlot,
  mascotCanvasAspect,
} from '@/constants/brandArtBounds';
import type { ModeIconName } from '@/lib/app/mainModeCards';
import type { MainModeId } from '@/lib/app/modes';

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
  const art = MASCOT_ART[modeId] ?? MASCOT_ART.classic;
  const { imgWidth, imgHeight, imageRight, imageBottom } = containArtInSlot(
    art,
    mascotCanvasAspect(modeId),
    MODE_CARD_MASCOT_SLOT.width,
    MODE_CARD_MASCOT_SLOT.height,
    MODE_CARD_MASCOT_SLOT.pad,
  );

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
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
      <View style={styles.columns}>
        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Ionicons
              name={iconName as ComponentProps<typeof Ionicons>['name']}
              size={THEMATIC_ICON_SIZE}
              color={colors.primary}
              style={styles.thematicIcon}
              testID={testID ? `${testID}-icon` : undefined}
            />
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          </View>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            {description}
          </Text>
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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: DesignTokens.modeCardMinHeight,
    borderRadius: DesignTokens.radius.card,
    borderWidth: 1,
    paddingVertical: DesignTokens.spacing.md,
    paddingLeft: DesignTokens.spacing.lg,
    paddingRight: DesignTokens.spacing.sm,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    paddingRight: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  thematicIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: DesignTokens.typography.cardTitle,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.15,
    textTransform: 'uppercase',
    lineHeight: 26,
  },
  description: {
    fontSize: DesignTokens.typography.caption,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
  },
  illustrationSlot: {
    width: MODE_CARD_MASCOT_SLOT.width,
    height: MODE_CARD_MASCOT_SLOT.height,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
});
