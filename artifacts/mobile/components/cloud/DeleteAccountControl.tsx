import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { PasswordField } from '@/components/cloud/PasswordField';
import { useCloudAccount } from '@/hooks/useCloudAccount';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { getActiveCloudEngine } from '@/lib/cloud';
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
  const cloud = useCloudAccount();
  const owner = useRef<string | null>(null);
  const opening = useRef(false);
  const { t } = useTranslation();
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [reauth, setReauth] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setPassword('');
    setReauth(false);
    setError(null);
    setDone(false);
    owner.current = null;
  }, [cloud.user?.id]);

  const openConfirm = async () => {
    if (busyRef.current || opening.current) return;
    const account = getActiveCloudEngine().getState().user?.id;
    if (!account) return;
    owner.current = account;
    opening.current = true;
    try {
      setError(null);
      setDone(false);
      const canExport = await accountHasExportablePgns().catch(() => false);
      if (!mounted.current || getActiveCloudEngine().getState().user?.id !== account) return;
      const actions = [
        ...(canExport
          ? [
              {
                label: t('account.deleteExport'),
                variant: 'secondary' as const,
                testID: 'account-delete-export',
                onPress: () => {
                  if (getActiveCloudEngine().getState().user?.id === account) void exportAccountPgns();
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
            if (getActiveCloudEngine().getState().user?.id !== account) return;
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
    } finally {
      opening.current = false;
    }
  };

  const submit = async () => {
    if (
      busyRef.current ||
      !password ||
      owner.current !== getActiveCloudEngine().getState().user?.id
    )
      return;
    busyRef.current = true;
    const submittedOwner = owner.current;
    try {
      setBusy(true);
      setError(null);
      const result = await performAccountDeletion(getActiveCloudEngine(), password);
      if (
        !mounted.current ||
        (getActiveCloudEngine().getState().user &&
          getActiveCloudEngine().getState().user?.id !== submittedOwner)
      )
        return;
      setBusy(false);
      if (result.ok) {
        setPassword('');
        setReauth(false);
        setDone(true);
        return;
      }
      if (result.error === 'reauth_failed') setError(t('account.deleteReauthFailed'));
      else if (result.error === 'uncertain') setError(t('account.deleteUncertain'));
      else if (result.error === 'offline') setError(t('account.deleteOffline'));
      else if (result.error === 'unavailable') setError(t('account.deleteUnavailable'));
      else if (result.error === 'session_expired') setError(t('account.deleteSession'));
      else setError(t('account.deleteFailed'));
    } catch {
      if (mounted.current) setError(t('account.deleteUncertain'));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        testID="account-delete-open"
        accessibilityRole="button"
        accessibilityLabel={t('account.delete')}
        onPress={() => {
          void openConfirm();
        }}
        style={[styles.btn, { borderColor: colors.border }]}
      >
        <Text
          style={{ color: colors.destructive, fontFamily: DesignTokens.typography.weightSemiBold }}
        >
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
      <Modal
        visible={reauth}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busyRef.current) {
            setPassword('');
            setReauth(false);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.backdrop}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          >
            <View
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t('account.deleteReauth')}
              </Text>
              {error ? (
                <Text testID="account-delete-error" style={{ color: colors.destructive }}>
                  {error}
                </Text>
              ) : null}
              <PasswordField
                testID="account-delete-password"
                purpose="current"
                value={password}
                onChangeText={setPassword}
                placeholder={t('cloud.password')}
              />
              <View style={styles.row}>
                <Pressable
                  testID="account-delete-reauth-cancel"
                  disabled={busy}
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
                  accessibilityRole="button"
                  accessibilityState={{ busy, disabled: busy || !password }}
                  onPress={() => {
                    void submit();
                  }}
                  style={[styles.btn, { borderColor: colors.destructive }]}
                >
                  <Text style={{ color: colors.destructive }}>{t('account.deleteConfirm')}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
