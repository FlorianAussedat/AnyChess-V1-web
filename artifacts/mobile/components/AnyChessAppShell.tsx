import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { DesignTokens } from '@/constants/designTokens';

export type AnyChessAppShellProps = {
  children: React.ReactNode;
  /**
   * Extra padding beyond safe insets (default matches historical ModeScreenShell).
   * Pass 0 when a screen manages its own content breathing room.
   */
  padExtra?: number;
  /**
   * When false, omit bottom safe-area padding (rare — e.g. keyboard-owned screens).
   * Default true preserves current screen appearance.
   */
  includeBottomSafeArea?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Shared application shell: page background + safe-area insets.
 *
 * Does NOT render bottom navigation (owned by root `_layout`).
 * Does NOT add `bottomNavContentHeight` — root already reserves that.
 * Feature game logic must stay out of this component.
 */
export function AnyChessAppShell({
  children,
  padExtra = DesignTokens.spacing.screenPadExtra,
  includeBottomSafeArea = true,
  style,
  contentStyle,
  testID,
}: AnyChessAppShellProps) {
  const colors = useColors();
  const insets = useAppSafeInsets();

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + padExtra,
          paddingBottom: includeBottomSafeArea ? insets.bottom + padExtra : padExtra,
        },
        style,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
