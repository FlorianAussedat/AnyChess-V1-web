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
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

export type HubModeCardProps = {
  title: string;
  description: string;
  icon?: ImageSourcePropType;
  onPress: () => void;
  testID?: string;
};

/**
 * Family A — navigation/mode menu card.
 * Shared architecture for Culture / Vision / Memorisation hubs.
 */
export function HubModeCard({ title, description, icon, onPress, testID }: HubModeCardProps) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <Image source={icon} style={styles.modeIcon} resizeMode="contain" />
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
    minHeight: 88,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: DesignTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIcon: { width: 40, height: 40 },
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
