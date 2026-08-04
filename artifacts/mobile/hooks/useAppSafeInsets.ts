/**
 * Centralized safe-area insets for AnyChess screens.
 *
 * Web uses fixed DesignTokens.webSafeArea fallbacks (historical 67 / 34).
 * Native uses react-native-safe-area-context.
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
};

export function useAppSafeInsets(): AppSafeInsets {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  return {
    isWeb,
    top: isWeb ? DesignTokens.webSafeArea.top : insets.top,
    bottom: isWeb ? DesignTokens.webSafeArea.bottom : insets.bottom,
    left: isWeb ? 0 : insets.left,
    right: isWeb ? 0 : insets.right,
  };
}
