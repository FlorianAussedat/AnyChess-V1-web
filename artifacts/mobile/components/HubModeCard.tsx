import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type HubModeCardProps = {
  title: string;
  description: string;
  icon?: ImageSourcePropType;
  /** Simple system icon when no brand image is available. */
  iconName?: IoniconName;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Family A — navigation/mode menu card.
 * Shared architecture for Culture / Vision / Memorisation / repertoire exercises.
 */
export function HubModeCard({
  title,
  description,
  icon,
  iconName,
  onPress,
  disabled = false,
  testID,
}: HubModeCardProps) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <Image source={icon} style={styles.modeIcon} resizeMode="contain" />
        </View>
      ) : iconName ? (
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
          <Ionicons name={iconName} size={24} color={colors.primary} />
        </View>
      ) : null}
      <View style={styles.textCol}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.lg,
    minHeight: 96,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: DesignTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIcon: { width: 66, height: 66 },
  textCol: { flex: 1, gap: 3 },
  cardTitle: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightRegular,
    lineHeight: 18,
  },
});
