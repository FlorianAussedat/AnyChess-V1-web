import React from 'react';
import { View } from 'react-native';
import { usePathname } from 'expo-router';
import { BottomNavigation } from './BottomNavigation';
import { showMainNavigation } from '@/lib/navigation/routes';

/** The bar occupies normal layout space, only on the four main routes after launch. */
export function NavigationShell({ children, introDone }: {
  children: React.ReactNode;
  introDone: boolean;
}) {
  const visible = showMainNavigation(usePathname(), introDone);
  return (
    <View style={{ flex: 1 }} testID="navigation-shell">
      <View style={{ flex: 1 }} testID="navigation-content">{children}</View>
      {visible ? <BottomNavigation /> : null}
    </View>
  );
}
