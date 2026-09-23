/**
 * Shared page scaffold for chess gameplay / training screens.
 *
 * Composable: optional ScreenHeader slots, then free children
 * (board, actions, answer, keypad, history, mode-specific content).
 * Classic Game spacing is the default reference.
 *
 * Uses a FlatList (VirtualizedList) as the page scroller so nested lists
 * (history, catalog) do not trip RN's "VirtualizedLists nested in ScrollViews"
 * warning. When scrollEnabled is false, a plain View is used instead.
 */
import React from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  children: React.ReactNode;
  /** When set with onBack (or default router.back), renders ScreenHeader. */
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showSound?: boolean;
  trailing?: React.ReactNode;
  /** Full header override — skips the built-in ScreenHeader. */
  header?: React.ReactNode;
  gap?: number;
  paddingHorizontal?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Extra top/bottom beyond safe insets (rarely needed). */
  padExtraTop?: number;
  padExtraBottom?: number;
  testID?: string;
  scrollEnabled?: boolean;
};

const EMPTY_LIST: readonly { key: string }[] = [];

function renderEmptyScaffoldItem(): null {
  return null;
}

export function ChessScreenScaffold({
  children,
  title,
  subtitle,
  onBack,
  showSound = false,
  trailing,
  header,
  gap = DesignTokens.chessScreen.gap,
  paddingHorizontal = DesignTokens.chessScreen.paddingHorizontal,
  contentContainerStyle,
  padExtraTop = 0,
  padExtraBottom = 0,
  testID = 'chess-screen-scaffold',
  scrollEnabled = true,
}: Props) {
  const colors = useColors();
  const router = useRouter();
  const { contentTop, contentBottom } = useAppSafeInsets();

  const resolvedHeader =
    header !== undefined ? (
      header
    ) : title != null ? (
      <ScreenHeader
        onBack={onBack ?? (() => router.back())}
        title={title}
        subtitle={subtitle}
        showSound={showSound}
        trailing={trailing}
      />
    ) : null;

  const bodyStyle: StyleProp<ViewStyle> = [
    styles.root,
    {
      paddingTop: contentTop + padExtraTop,
      paddingBottom: contentBottom + padExtraBottom,
      paddingHorizontal,
      gap,
    },
    contentContainerStyle,
  ];

  const body = (
    <View style={bodyStyle}>
      {resolvedHeader}
      {children}
    </View>
  );

  if (!scrollEnabled) {
    return (
      <View
        style={[
          styles.root,
          {
            flex: 1,
            backgroundColor: colors.background,
            paddingTop: contentTop + padExtraTop,
            paddingBottom: contentBottom + padExtraBottom,
            paddingHorizontal,
            gap,
          },
          contentContainerStyle,
        ]}
        testID={testID}
      >
        {resolvedHeader}
        {children}
      </View>
    );
  }

  return (
    <FlatList
      data={EMPTY_LIST}
      renderItem={renderEmptyScaffoldItem}
      ListHeaderComponent={body}
      extraData={children}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.root}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1 },
});
