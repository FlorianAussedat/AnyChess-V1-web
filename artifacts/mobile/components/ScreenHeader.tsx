import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton } from '@/components/BackButton';
import { SoundToggle } from '@/components/SoundToggle';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  onBack: () => void;
  title?: string;
  subtitle?: string;
  showSound?: boolean;
  /** Extra trailing controls (keep board-specific toggles out of this). */
  trailing?: React.ReactNode;
  backTestID?: string;
  /** Allow a long title to wrap instead of truncating with ellipsis. */
  titleNumberOfLines?: number;
};

/**
 * Standard screen header: [ < ]  Title…  [sound?]
 * Board-specific controls belong near the ChessBoard, not here.
 */
export function ScreenHeader({
  onBack,
  title,
  subtitle,
  showSound = false,
  trailing,
  backTestID,
  titleNumberOfLines = 1,
}: Props) {
  const colors = useColors();
  const showTrailing = Boolean(trailing) || showSound;
  return (
    <View style={[styles.header, titleNumberOfLines > 1 ? styles.headerWrap : null]}>
      <BackButton onPress={onBack} testID={backTestID} />
      <View style={styles.titleBlock}>
        {title ? (
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={titleNumberOfLines}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showTrailing ? (
        <View style={styles.trailing}>
          {trailing}
          {showSound ? <SoundToggle /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
  },
  headerWrap: {
    alignItems: 'flex-start',
  },
  titleBlock: { flex: 1, gap: 1, minWidth: 0 },
  title: {
    fontSize: DesignTokens.typography.modeTitle,
    lineHeight: 22,
    fontFamily: DesignTokens.typography.weightBold,
  },
  subtitle: {
    fontSize: DesignTokens.typography.micro,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: DesignTokens.spacing.sm },
});
