import { requestAccountFocus } from '@/lib/cloud/accountFocus';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useCloudAccount } from '@/hooks/useCloudAccount';
import { DesignTokens } from '@/constants/designTokens';
import { presentAppDialog } from '@/lib/ui/appDialogStore';
import { navigateMainTab } from '@/lib/navigation/routes';

/** Compact shortcuts: one account destination, plus settings, using the existing dialog. */
export function GeneralMenu() {
  const colors = useColors();
  const { t } = useTranslation();
  const cloud = useCloudAccount();
  const pathname = usePathname();
  const router = useRouter();
  const open = () => presentAppDialog({
    title: t('nav.generalMenu'),
    message: '',
    variant: 'info',
    actions: [
      {
        label: t(cloud.sessionReady ? (cloud.user ? 'nav.userAccount' : 'nav.userSignIn') : 'nav.utilisateur'),
        onPress: () => { requestAccountFocus(); navigateMainTab(router, pathname, '/utilisateur'); },
        testID: 'general-menu-account',
      },
      {
        label: t('nav.parametres'),
        onPress: () => navigateMainTab(router, pathname, '/parametres'),
        testID: 'general-menu-settings',
      },
      { label: t('common.close'), onPress: () => {}, testID: 'general-menu-close' },
    ],
  });
  return (
    <Pressable onPress={open} testID="general-menu" accessibilityRole="button"
      accessibilityLabel={t('nav.generalMenu')}
      style={({ pressed }) => [styles.button, {
        backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1,
      }]}>
      <Ionicons name="menu" size={24} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: DesignTokens.minTouchTarget, height: DesignTokens.minTouchTarget,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
  },
});
