import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useCloudAccount } from '@/hooks/useCloudAccount';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import type { CloudAuthError, CloudSyncStatus } from '@/lib/cloud';

function statusKey(status: CloudSyncStatus): 'cloud.statusSynced' | 'cloud.statusPending' | 'cloud.statusError' | 'cloud.statusOffline' | 'cloud.statusSignedOut' | 'cloud.statusUnconfigured' {
  if (status === 'synced') return 'cloud.statusSynced';
  if (status === 'pending') return 'cloud.statusPending';
  if (status === 'error') return 'cloud.statusError';
  if (status === 'offline') return 'cloud.statusOffline';
  if (status === 'unconfigured') return 'cloud.statusUnconfigured';
  return 'cloud.statusSignedOut';
}

function authErrorKey(error?: CloudAuthError): 'cloud.errorInvalid' | 'cloud.errorTaken' | 'cloud.errorWeak' | 'cloud.errorConfirmEmail' | 'cloud.errorOffline' | 'cloud.errorRejected' {
  if (error === 'email_taken') return 'cloud.errorTaken';
  if (error === 'weak_password') return 'cloud.errorWeak';
  if (error === 'confirm_email') return 'cloud.errorConfirmEmail';
  if (error === 'offline') return 'cloud.errorOffline';
  if (error === 'invalid_credentials') return 'cloud.errorInvalid';
  return 'cloud.errorRejected';
}

export function CloudAccountSection() {
  const colors = useColors();
  const { t } = useTranslation();
  const cloud = useCloudAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (action: () => Promise<{ ok: boolean; error?: CloudAuthError }>) => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setInfo(null);
    try {
      const result = await action();
      if (!result.ok) setFormError(t(authErrorKey(result.error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} testID="cloud-account-section">
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('cloud.section')}
      </Text>
      <Text
        style={[styles.status, { color: cloud.status === 'error' ? colors.destructive : colors.mutedForeground }]}
        testID="cloud-sync-status"
      >
        {t(statusKey(cloud.status))}
      </Text>
      {cloud.user ? (
        <Text style={[styles.hint, { color: colors.foreground }]} testID="cloud-signed-in">
          {t('cloud.signedInAs', { email: cloud.user.email })}
        </Text>
      ) : null}
      {cloud.status === 'unconfigured' ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]} testID="cloud-unconfigured">
          {t('cloud.unconfiguredHint')}
        </Text>
      ) : null}
      {!cloud.user && cloud.status !== 'unconfigured' ? (
        <View style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('cloud.email')}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
            testID="cloud-email"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t('cloud.password')}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
            testID="cloud-password"
          />
          <View style={styles.row}>
            <Pressable
              testID="cloud-signin"
              disabled={busy}
              onPress={() => {
                void run(() => cloud.signIn(email.trim(), password));
              }}
              style={[styles.btn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.primary }}>{t('cloud.signIn')}</Text>
            </Pressable>
            <Pressable
              testID="cloud-signup"
              disabled={busy}
              onPress={() => {
                void run(() => cloud.signUp(email.trim(), password));
              }}
              style={[styles.btn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.primary }}>{t('cloud.signUp')}</Text>
            </Pressable>
          </View>
          <Pressable
            testID="cloud-recover"
            disabled={busy || !email.trim()}
            onPress={() => {
              void (async () => {
                const result = await cloud.recoverPassword(email.trim());
                if (result.ok) setInfo(t('cloud.recoverSent'));
                else setFormError(t(authErrorKey(result.error)));
              })();
            }}
          >
            <Text style={{ color: colors.mutedForeground }}>{t('cloud.recover')}</Text>
          </Pressable>
        </View>
      ) : null}
      {cloud.user ? (
        <View style={styles.row}>
          <Pressable
            testID="cloud-sync"
            disabled={busy}
            onPress={() => {
              void cloud.sync();
            }}
            style={[styles.btn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.primary }}>{t('cloud.syncNow')}</Text>
          </Pressable>
          <Pressable
            testID="cloud-signout"
            disabled={busy}
            onPress={() => {
              void cloud.signOut();
            }}
            style={[styles.btn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.destructive }}>{t('cloud.signOut')}</Text>
          </Pressable>
        </View>
      ) : null}
      {formError ? (
        <Text style={{ color: colors.destructive }} testID="cloud-form-error">
          {formError}
        </Text>
      ) : null}
      {info ? (
        <Text style={{ color: colors.mutedForeground }} testID="cloud-form-info">
          {info}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: DesignTokens.spacing.sm },
  sectionLabel: {
    marginTop: DesignTokens.spacing.sm,
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  status: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  form: { gap: 8 },
  input: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: DesignTokens.minTouchTarget,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: DesignTokens.minTouchTarget,
    justifyContent: 'center',
  },
});
