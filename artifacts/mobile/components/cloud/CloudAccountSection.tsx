import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useCloudAccount } from '@/hooks/useCloudAccount';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { confirmationResendWaitSeconds } from '@/lib/cloud';
import { consumeAuthReturn } from '@/lib/cloud/authReturn';
import type { CloudAuthError, CloudSyncStatus } from '@/lib/cloud';
import type { MessageKey } from '@/lib/i18n/messages';

const AUTH_ERROR_KEYS: Record<CloudAuthError, MessageKey> = {
  invalid_credentials: 'cloud.errorInvalid',
  email_taken: 'cloud.errorTaken',
  weak_password: 'cloud.errorWeak',
  confirm_email: 'cloud.confirmSent',
  email_not_confirmed: 'cloud.errorEmailNotConfirmed',
  email_invalid: 'cloud.errorEmailInvalid',
  rate_limited: 'cloud.errorRateLimit',
  offline: 'cloud.errorOffline',
  rejected: 'cloud.errorUnexpected',
  unexpected: 'cloud.errorUnexpected',
  unconfigured: 'cloud.errorUnexpected',
};

function backupStatusKey(
  status: CloudSyncStatus,
): 'cloud.statusSynced' | 'cloud.statusPending' | 'cloud.statusError' | 'cloud.statusOffline' {
  if (status === 'synced') return 'cloud.statusSynced';
  if (status === 'error') return 'cloud.statusError';
  if (status === 'offline') return 'cloud.statusOffline';
  return 'cloud.statusPending';
}

export function CloudAccountSection() {
  const colors = useColors();
  const router = useRouter();
  const { t } = useTranslation();
  const cloud = useCloudAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const pending = cloud.pendingConfirmationEmail;

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  useEffect(() => {
    if (!cloud.user) return;
    const back = consumeAuthReturn();
    if (!back) return;
    router.replace(back as Href);
  }, [cloud.user, router]);

  const waitSeconds = confirmationResendWaitSeconds(now);

  const run = async (action: () => Promise<{ ok: boolean; error?: CloudAuthError }>) => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setInfo(null);
    try {
      const result = await action();
      if (!result.ok && result.error !== 'confirm_email' && result.error !== 'email_not_confirmed') {
        setFormError(t(AUTH_ERROR_KEYS[result.error ?? 'unexpected']));
      }
    } finally {
      setBusy(false);
    }
  };

  const accountText =
    cloud.status === 'unconfigured'
      ? t('cloud.statusUnconfigured')
      : cloud.user
        ? t('cloud.signedInAs', { email: cloud.user.email })
        : t('cloud.statusSignedOut');

  const confirmText =
    cloud.pendingConfirmationReason === 'signin'
      ? t('cloud.errorEmailNotConfirmed')
      : t('cloud.confirmSent');

  return (
    <View style={styles.wrap} testID="cloud-account-section">
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('cloud.section')}
      </Text>
      <Text
        style={[styles.status, { color: cloud.user ? colors.foreground : colors.mutedForeground }]}
        testID="cloud-account-status"
      >
        {accountText}
      </Text>
      {cloud.user ? (
        <View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {t('cloud.backupLabel')}
          </Text>
          <Text
            style={[
              styles.status,
              {
                color:
                  cloud.status === 'error' || cloud.status === 'offline'
                    ? colors.destructive
                    : colors.mutedForeground,
              },
            ]}
            testID="cloud-backup-status"
          >
            {t(backupStatusKey(cloud.status))}
          </Text>
        </View>
      ) : null}
      {cloud.status === 'unconfigured' ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]} testID="cloud-unconfigured">
          {t('cloud.unconfiguredHint')}
        </Text>
      ) : null}
      {pending && !cloud.user ? (
        <View style={styles.form} testID="cloud-confirm-panel">
          <Text style={[styles.hint, { color: colors.foreground }]} testID="cloud-confirm-message">
            {confirmText}
          </Text>
          <View style={styles.row}>
            <Pressable
              testID="cloud-resend"
              disabled={busy || waitSeconds > 0}
              onPress={() => {
                void (async () => {
                  if (busy || confirmationResendWaitSeconds() > 0) return;
                  setBusy(true);
                  setFormError(null);
                  setInfo(null);
                  try {
                    const result = await cloud.resendSignupConfirmation(pending);
                    if (result.ok) setInfo(t('cloud.resendSent'));
                    else setFormError(t(AUTH_ERROR_KEYS[result.error ?? 'unexpected']));
                  } finally {
                    setNow(Date.now());
                    setBusy(false);
                  }
                })();
              }}
              style={[styles.btn, { borderColor: colors.border, opacity: waitSeconds > 0 ? 0.55 : 1 }]}
            >
              <Text style={{ color: colors.primary }}>
                {waitSeconds > 0 ? t('cloud.resendWait', { seconds: waitSeconds }) : t('cloud.resendEmail')}
              </Text>
            </Pressable>
            <Pressable
              testID="cloud-back-to-signin"
              disabled={busy}
              onPress={() => {
                cloud.dismissPendingConfirmation();
                setFormError(null);
                setInfo(null);
              }}
              style={[styles.btn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.primary }}>{t('cloud.backToSignIn')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {!cloud.user && !pending && cloud.status !== 'unconfigured' ? (
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
                else setFormError(t(AUTH_ERROR_KEYS[result.error ?? 'unexpected']));
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
      {cloud.lastError === 'schema_missing' ? (
        <Text style={[styles.hint, { color: colors.destructive }]} testID="cloud-schema-missing">
          {t('cloud.errorSchema')}
        </Text>
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
