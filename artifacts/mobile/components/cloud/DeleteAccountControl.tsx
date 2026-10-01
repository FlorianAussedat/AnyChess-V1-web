import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { cloudSyncEngine } from '@/lib/cloud';
import { performAccountDeletion } from '@/lib/cloud/accountLifecycle';
import { accountHasExportablePgns, exportAccountPgns } from '@/lib/cloud/exportAccountPgns';
import { presentAppDialog } from '@/lib/ui/appDialogStore';

/**
 * Signed-in account deletion. The confirm dialog explains the wipe.
 * The password step reauthenticates. Local data is removed only after the
 * server accepts the deletion, or after a later probe shows the account is gone.
 */
export function DeleteAccountControl() {
  const colors = useColors();
  const { t } = useTranslation();
  const [reauth, setReauth] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const openConfirm = async () => {
    setError(null);
    setDone(false);
    const canExport = await accountHasExportablePgns().catch(() => false);
    const actions = [
      ...(canExport
        ? [
            {
              label: t('account.deleteExport'),
              variant: 'secondary' as const,
              testID: 'account-delete-export',
              onPress: () => {
                void exportAccountPgns();
              },
            },
          ]
        : []),
      {
        label: t('common.cancel'),
        variant: 'secondary' as const,
        testID: 'account-delete-cancel',
        onPress: () => {},
      },
      {
        label: t('account.delete'),
        variant: 'destructive' as const,
        testID: 'account-delete-confirm',
        onPress: () => {
          setPassword('');
          setReauth(true);
        },
      },
    ];
    presentAppDialog({
      title: t('account.deleteTitle'),
      message: t('account.deleteBody'),
      variant: 'destructive',
      actions,
    });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await performAccountDeletion(cloudSyncEngine, password);
    setBusy(false);
    if (result.ok) {
      setPassword('');
      setReauth(false);
      setDone(true);
      return;
    }
    setPassword('');
    if (result.error === 'reauth_failed') setError(t('account.deleteReauthFailed'));
    else if (result.error === 'offline') setError(t('account.deleteOffline'));
    else setError(t('account.deleteFailed'));
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        testID="account-delete-open"
        onPress={() => {
          void openConfirm();
        }}
        style={[styles.btn, { borderColor: colors.border }]}
      >
        <Text style={{ color: colors.destructive, fontFamily: DesignTokens.typography.weightSemiBold }}>
          {t('account.delete')}
        </Text>
      </Pressable>
      {done ? (
        <Text testID="account-delete-done" style={{ color: colors.mutedForeground }}>
          {t('account.deleteDone')}
        </Text>
      ) : null}
      {error && !reauth ? (
        <Text testID="account-delete-error" style={{ color: colors.destructive }}>
          {error}
        </Text>
      ) : null}
      <Modal visible={reauth} transparent animationType="fade" onRequestClose={() => setReauth(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>{t('account.deleteReauth')}</Text>
            {error ? (
              <Text testID="account-delete-error" style={{ color: colors.destructive }}>
                {error}
              </Text>
            ) : null}
            <TextInput
              testID="account-delete-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder={t('cloud.password')}
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input },
              ]}
            />
            <Pressable
              testID="account-delete-password-toggle"
              onPress={() => setShowPassword((v) => !v)}
            >
              <Text style={{ color: colors.primary }}>
                {showPassword ? t('account.hidePassword') : t('account.showPassword')}
              </Text>
            </Pressable>
            <View style={styles.row}>
              <Pressable
                testID="account-delete-reauth-cancel"
                onPress={() => {
                  setPassword('');
                  setReauth(false);
                }}
                style={[styles.btn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.mutedForeground }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                testID="account-delete-submit"
                disabled={busy || !password}
                onPress={() => {
                  void submit();
                }}
                style={[styles.btn, { borderColor: colors.destructive }]}
              >
                <Text style={{ color: colors.destructive }}>{t('account.deleteConfirm')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: DesignTokens.minTouchTarget,
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    padding: 16,
    gap: 10,
  },
  title: {
    fontFamily: DesignTokens.typography.weightBold,
    fontSize: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: DesignTokens.minTouchTarget,
  },
});
