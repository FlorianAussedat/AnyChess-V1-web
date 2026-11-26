import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useCloudAccount } from '@/hooks/useCloudAccount';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { DeleteAccountControl } from '@/components/cloud/DeleteAccountControl';
import { PasswordField } from '@/components/cloud/PasswordField';
import { confirmationResendWaitSeconds } from '@/lib/cloud';
import { confirmAction } from '@/lib/openings/confirmAction';
import { consumeAuthReturn } from '@/lib/cloud/authReturn';
import { setAuthDraftEmail, peekAuthDraftEmail } from '@/lib/cloud/authDraft';
import {
  clearRememberedEmail,
  readRememberedEmail,
  rememberEmailAfterSignIn,
} from '@/lib/cloud/rememberedEmail';
import { defaultKeyValueStorage } from '@/lib/storage';
import type { CloudAuthError, CloudSyncStatus } from '@/lib/cloud';
import type { MessageKey } from '@/lib/i18n/messages';

const SIGN_IN_TIMEOUT_MS = 20_000;

export const AUTH_ERROR_KEYS: Record<CloudAuthError, MessageKey> = {
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
  signup_ambiguous: 'cloud.signupAmbiguous',
};

function authFailureText(
  result: { error?: CloudAuthError; retryAfterSeconds?: number },
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): string {
  if (result.error === 'rate_limited' && result.retryAfterSeconds && result.retryAfterSeconds > 0) {
    return t('cloud.rateLimitWait', { seconds: result.retryAfterSeconds });
  }
  return t(AUTH_ERROR_KEYS[result.error ?? 'unexpected']);
}

function backupStatusKey(
  status: CloudSyncStatus,
):
  | 'cloud.statusSynced'
  | 'cloud.statusPending'
  | 'cloud.statusSyncing'
  | 'cloud.statusError'
  | 'cloud.statusOffline'
  | 'cloud.statusWaitingWifi' {
  if (status === 'synced') return 'cloud.statusSynced';
  if (status === 'syncing') return 'cloud.statusSyncing';
  if (status === 'error') return 'cloud.statusError';
  if (status === 'offline') return 'cloud.statusOffline';
  if (status === 'waiting_wifi') return 'cloud.statusPending';
  return 'cloud.statusPending';
}

export function CloudAccountSection() {
  const colors = useColors();
  const router = useRouter();
  const { t } = useTranslation();
  const cloud = useCloudAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const attemptRef = useRef(0);
  const aliveRef = useRef(true);
  const signingRef = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [guestImportReady, setGuestImportReady] = useState(false);

  const pending = cloud.pendingConfirmationEmail;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      attemptRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const draft = peekAuthDraftEmail();
    if (draft) {
      setEmail(draft);
      return;
    }
    let cancelled = false;
    void readRememberedEmail(defaultKeyValueStorage).then((saved) => {
      if (cancelled || !saved.enabled || !saved.email) return;
      setEmail(saved.email);
      setRemember(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  useEffect(() => {
    if (!cloud.user) {
      setGuestImportReady(false);
      return;
    }
    let cancelled = false;
    void cloud.guestDataAvailable().then((ready) => {
      if (!cancelled) setGuestImportReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, [cloud.user]);

  useEffect(() => {
    if (!cloud.user) return;
    const back = consumeAuthReturn();
    if (!back) return;
    router.replace(back as Href);
  }, [cloud.user, router]);

  const waitSeconds = confirmationResendWaitSeconds(now);

  const submitSignIn = () => {
    if (busy || signingIn || signingRef.current) return;
    signingRef.current = true;
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    const abandoned = () => !aliveRef.current || attemptRef.current !== attempt;
    setSigningIn(true);
    setBusy(true);
    setFormError(null);
    setInfo(null);
    const timer = setTimeout(() => {
      if (attemptRef.current !== attempt) return;
      attemptRef.current += 1;
      signingRef.current = false;
      setSigningIn(false);
      setBusy(false);
      setFormError(t('cloud.signInTimeout'));
    }, SIGN_IN_TIMEOUT_MS);
    void (async () => {
      try {
        const result = await cloud.signIn(email.trim(), password, { abandoned });
        if (abandoned()) return;
        if (result.ok) {
          try {
            await rememberEmailAfterSignIn(defaultKeyValueStorage, email.trim(), remember);
          } catch {
            setFormError(t('cloud.localSaveFailed'));
          }
          return;
        }
        if (result.error !== 'confirm_email' && result.error !== 'email_not_confirmed') {
          setFormError(authFailureText(result, t));
        }
      } catch {
        if (!abandoned()) setFormError(t('cloud.errorUnexpected'));
      } finally {
        clearTimeout(timer);
        if (!abandoned()) {
          signingRef.current = false;
          setSigningIn(false);
          setBusy(false);
        }
      }
    })();
  };

  const run = async (action: () => Promise<{ ok: boolean; error?: CloudAuthError }>) => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setInfo(null);
    try {
      const result = await action();
      if (!result.ok && result.error !== 'confirm_email' && result.error !== 'email_not_confirmed') {
        setFormError(authFailureText(result, t));
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
        testID={cloud.status === 'unconfigured' ? 'cloud-unconfigured' : 'cloud-account-status'}
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
            accessibilityLiveRegion="polite"
            testID="cloud-backup-status"
          >
            {t(backupStatusKey(cloud.status))}
          </Text>
          {cloud.lastSyncedAt ? <Text style={[styles.hint, { color: colors.mutedForeground }]} testID="cloud-last-synced">{t('cloud.lastSyncedAt', { date: new Date(cloud.lastSyncedAt).toLocaleString() })}</Text> : null}
        </View>
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
            onChangeText={(value) => {
              setEmail(value);
              setAuthDraftEmail(value);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            importantForAutofill="yes"
            placeholder={t('cloud.email')}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
            testID="cloud-email"
          />
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder={t('cloud.password')}
            testID="cloud-password"
            purpose="current"
            onSubmitEditing={submitSignIn}
          />
          <Pressable
            testID="cloud-remember-email"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            accessibilityLabel={t('cloud.rememberEmail')}
            onPress={() => {
              setRemember((current) => {
                if (current) void clearRememberedEmail(defaultKeyValueStorage);
                return !current;
              });
            }}
            style={styles.remember}
          >
            <View
              style={[
                styles.check,
                {
                  borderColor: colors.primary,
                  backgroundColor: remember ? colors.primary : 'transparent',
                },
              ]}
            />
            <Text style={[styles.rememberText, { color: colors.foreground }]}>{t('cloud.rememberEmail')}</Text>
          </Pressable>
          <Pressable
            testID="cloud-signin"
            disabled={busy || signingIn}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || signingIn, busy: signingIn }}
            accessibilityLabel={signingIn ? t('cloud.signInBusy') : t('cloud.signIn')}
            onPress={submitSignIn}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            {signingIn ? (
              <ActivityIndicator color={colors.primaryForeground} testID="cloud-signin-busy" />
            ) : null}
            <Text
              style={[styles.primaryLabel, { color: colors.primaryForeground }]}
              numberOfLines={2}
            >
              {signingIn ? t('cloud.signInBusy') : t('cloud.signIn')}
            </Text>
          </Pressable>
          <Pressable
            testID="cloud-recover"
            disabled={busy || !email.trim()}
            onPress={() => {
              void (async () => {
                const result = await cloud.recoverPassword(email.trim());
                if (result.ok) setInfo(t('cloud.recoverSent'));
                else setFormError(authFailureText(result, t));
              })();
            }}
            style={styles.recover}
          >
            <Text style={{ color: colors.mutedForeground, flexShrink: 1 }}>{t('cloud.recover')}</Text>
          </Pressable>
          <Pressable
            testID="cloud-signup"
            disabled={busy}
            onPress={() => {
              setAuthDraftEmail(email);
              router.push('/creer-compte' as Href);
            }}
            style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Text style={[styles.secondaryLabel, { color: colors.foreground }]} numberOfLines={2}>
              {t('cloud.signUp')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {cloud.user && guestImportReady ? (
        <Pressable
          testID="cloud-import-guest"
          disabled={busy}
          onPress={() => {
            confirmAction(t('cloud.importGuestTitle'), t('cloud.importGuestBody'), () => {
              void (async () => {
                setFormError(null);
                const result = await cloud.importGuestData();
                if (!result.ok) {
                  setFormError(
                    result.error === 'remote_unverified'
                      ? t('cloud.importGuestUnverified')
                      : t('cloud.errorUnexpected'),
                  );
                } else setGuestImportReady(false);
              })();
            }, { confirmLabel: t('cloud.importGuest') });
          }}
          style={[styles.btn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.primary }}>{t('cloud.importGuest')}</Text>
        </Pressable>
      ) : null}
      {cloud.user ? (
        <View style={styles.row}>
          <Pressable
            testID="cloud-sync"
            accessibilityRole="button"
            accessibilityLabel={t('cloud.syncNow')}
            disabled={busy || cloud.status === 'syncing'}
            onPress={() => {
              void cloud.sync();
            }}
            style={[styles.btn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.primary }}>{t('cloud.syncNow')}</Text>
          </Pressable>
          <Pressable
            testID="cloud-signout"
            onPress={() => {
              confirmAction(
                t('cloud.signOutTitle'),
                t('cloud.signOutBody'),
                () => {
                  void (async () => {
                    setFormError(null);
                    setInfo(null);
                    try {
                      const result = await cloud.signOut();
                      if (!result.ok) setFormError(t('cloud.signOutFailed'));
                    } catch {
                      setFormError(t('cloud.signOutFailed'));
                    }
                  })();
                },
                { confirmLabel: t('cloud.signOut'), destructive: true },
              );
            }}
            style={[styles.btn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.destructive }}>{t('cloud.signOut')}</Text>
          </Pressable>
        </View>
      ) : null}
      {cloud.user ? <DeleteAccountControl /> : null}
      {cloud.lastError === 'local_save_failed' ? (
        <Text style={[styles.hint, { color: colors.destructive }]} testID="cloud-local-save-error">
          {t('cloud.localSaveFailed')}
        </Text>
      ) : null}
      {cloud.lastError === 'schema_missing' ? (
        <Text style={[styles.hint, { color: colors.destructive }]} testID="cloud-schema-missing">
          {t('cloud.errorSchema')}
        </Text>
      ) : null}
      {formError || cloud.lastError === 'sign_out_failed' ? (
        <Text style={{ color: colors.destructive }} testID="cloud-form-error">
          {formError ?? t('cloud.signOutFailed')}
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
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: DesignTokens.minTouchTarget,
  },
  check: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 4,
  },
  rememberText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
  },
  primaryBtn: {
    width: '100%',
    minHeight: DesignTokens.minTouchTarget,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryLabel: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  secondaryBtn: {
    width: '100%',
    minHeight: DesignTokens.minTouchTarget,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  recover: {
    minHeight: DesignTokens.minTouchTarget,
    justifyContent: 'center',
  },
  btn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: DesignTokens.minTouchTarget,
    justifyContent: 'center',
  },
});
