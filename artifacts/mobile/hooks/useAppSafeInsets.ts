/**
 * Centralized safe-area insets for AnyChess screens.
 *
 * Native uses react-native-safe-area-context.
 * Web prefers real insets when present; otherwise a small fallback
 * (historical 67px desktop pad caused excess empty space on mobile web/Android).
 *
 * Bottom navigation height is reserved by the root layout
 * (`DesignTokens.bottomNavContentHeight`) — do not add that value again here.
 */
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DesignTokens } from '@/constants/designTokens';

export type AppSafeInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  isWeb: boolean;
  /** Recommended content top padding (inset + compact breathing room). */
  contentTop: number;
  /** Recommended content bottom padding. */
  contentBottom: number;
};

export function useAppSafeInsets(): AppSafeInsets {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const isAndroid = Platform.OS === 'android';

  let top: number;
  if (isWeb) {
    top = insets.top > 0 ? insets.top : 12;
  } else {
    top = insets.top;
  }

  const bottom = isWeb
    ? insets.bottom > 0
      ? insets.bottom
      : DesignTokens.webSafeArea.bottom
    : insets.bottom;

  const topExtra = isAndroid ? 2 : isWeb ? 4 : 6;
  const bottomExtra = isAndroid ? 8 : 12;

  return {
    isWeb,
    top,
    bottom,
    left: isWeb ? 0 : insets.left,
    right: isWeb ? 0 : insets.right,
    contentTop: top + topExtra,
    contentBottom: bottom + bottomExtra,
  };
}
