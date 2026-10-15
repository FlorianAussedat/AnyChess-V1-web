/**
 * Dedicated account creation. Pseudo, email, password, optional avatar.
 * Level, rating and years of practice stay on the profile screen.
 */
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PasswordField } from '@/components/cloud/PasswordField';
import { AvatarField } from '@/components/profile/AvatarField';
import { DesignTokens } from '@/constants/designTokens';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useColors } from '@/hooks/useColors';
import { useCloudAccount } from '@/hooks/useCloudAccount';
import { useTranslation } from '@/hooks/useTranslation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { AUTH_ERROR_KEYS } from '@/components/cloud/CloudAccountSection';
import { confirmationResendWaitSeconds } from '@/lib/cloud';
import { setAuthDraftEmail, peekAuthDraftEmail } from '@/lib/cloud/authDraft';
import { submitCreateAccount } from '@/lib/profile/createAccount';
import { defaultKeyValueStorage } from '@/lib/storage';
import type { CloudAuthError } from '@/lib/cloud';

export default function CreerCompteScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t } = useTranslation();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const { profile, updateProfile } = useUserProfile();
  const cloud = useCloudAccount();
  const [pseudo, setPseudo] = useState(profile.username ?? '');
  const [pseudoEdited, setPseudoEdited] = useState(false);
  const [email, setEmail] = useState(() => peekAuthDraftEmail());
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [mascotId, setMascotId] = useState<string | null>(null);
  const [mascotPreview, setMascotPreview] = useState<ImageSourcePropType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<'taken' | 'ambiguous' | 'sent' | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (pseudoEdited) return;
    if (profile.username && !pseudo) setPseudo(profile.username);
  }, [profile.username, pseudo, pseudoEdited]);

  const goSignIn = () => {
    setAuthDraftEmail(email);
    router.replace('/utilisateur');
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setInfo(null);
    const result = await submitCreateAccount({
      username: pseudo,
      email,
      password,
      avatarDataUrl: avatar,
      mascotId,
      storage: defaultKeyValueStorage,
      updateUsername: async (username) => {
        await updateProfile({ username });
      },
      signUp: (nextEmail, nextPassword) => cloud.signUp(nextEmail, nextPassword),
    });
    setBusy(false);
    if (result.ok) {
      router.replace('/utilisateur');
      return;
    }
    if (result.error === 'username_required') {
      setError(t('account.usernameRequired'));
      return;
    }
    if (result.error === 'email_taken') {
      setNotice('taken');
      return;
    }
    if (result.error === 'signup_ambiguous') {
      setNotice('ambiguous');
      return;
    }
    if (result.error === 'confirm_email') {
      setNotice('sent');
      return;
    }
    if (result.error === 'rate_limited' && result.retryAfterSeconds && result.retryAfterSeconds > 0) {
      setError(t('cloud.rateLimitWait', { seconds: result.retryAfterSeconds }));
      return;
    }
    const key = AUTH_ERROR_KEYS[(result.error as CloudAuthError) ?? 'unexpected'] ?? 'cloud.errorUnexpected';
    setError(t(key));
  };

  const recover = async () => {
    setError(null);
    setInfo(null);
    const result = await cloud.recoverPassword(email.trim());
    if (result.ok) setInfo(t('cloud.recoverSent'));
    else if (result.error === 'rate_limited') {
      const wait = confirmationResendWaitSeconds();
      setError(wait > 0 ? t('cloud.rateLimitWait', { seconds: wait }) : t('cloud.errorRateLimit'));
    } else setError(t(AUTH_ERROR_KEYS[result.error ?? 'unexpected']));
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    const result = await cloud.resendSignupConfirmation(email.trim());
    if (result.ok) setInfo(t('cloud.resendSent'));
    else if (result.error === 'rate_limited') {
      const wait = confirmationResendWaitSeconds();
      setError(wait > 0 ? t('cloud.rateLimitWait', { seconds: wait }) : t('cloud.errorRateLimit'));
    } else setError(t(AUTH_ERROR_KEYS[result.error ?? 'unexpected']));
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.page,
        { paddingTop: topPad + DesignTokens.spacing.md, paddingBottom: bottomPad + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
      testID="create-account-screen"
    >
      <ScreenHeader onBack={goSignIn} title={t('account.createTitle')} backTestID="create-account-back" />
      <AvatarField
        username={pseudo}
        imageUri={mascotId ? null : avatar}
        imageSource={mascotPreview}
        onChange={async (next, context) => {
          if (context?.mascotId) {
            setMascotId(context.mascotId);
            setAvatar(null);
            const mod = await import('@/components/profile/mascotImages');
            setMascotPreview(mod.mascotImage(context.mascotId));
            return;
          }
          setMascotId(null);
          setMascotPreview(null);
          setAvatar(next);
        }}
        testID="create-account-avatar"
      />
      <TextInput
        testID="create-account-pseudo"
        value={pseudo}
        onChangeText={(value) => {
          setPseudoEdited(true);
          setPseudo(value);
        }}
        autoCapitalize="words"
        placeholder={t('profil.usernamePlaceholder')}
        placeholderTextColor={colors.mutedForeground}
        maxLength={40}
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
      />
      <TextInput
        testID="create-account-email"
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
      />
      <PasswordField
        testID="create-account-password"
        purpose="new"
        value={password}
        onChangeText={setPassword}
        placeholder={t('cloud.password')}
      />
      <Pressable
        testID="create-account-submit"
        disabled={busy}
        onPress={() => {
          void submit();
        }}
        style={[styles.btn, { borderColor: colors.primary, backgroundColor: colors.card }]}
      >
        <Text style={{ color: colors.primary, fontFamily: DesignTokens.typography.weightSemiBold }}>
          {t('account.createSubmit')}
        </Text>
      </Pressable>
      {notice === 'taken' ? (
        <Text testID="create-account-taken" style={{ color: colors.foreground }}>
          {t('cloud.errorTaken')}
        </Text>
      ) : null}
      {notice === 'ambiguous' ? (
        <Text testID="create-account-ambiguous" style={{ color: colors.foreground }}>
          {t('cloud.signupAmbiguous')}
        </Text>
      ) : null}
      {notice === 'sent' ? (
        <Text testID="create-account-sent" style={{ color: colors.foreground }}>
          {t('cloud.confirmSent')}
        </Text>
      ) : null}
      {notice ? (
        <View style={styles.actions}>
          <Pressable testID="create-account-go-signin" onPress={goSignIn}>
            <Text style={{ color: colors.primary }}>{t('cloud.signIn')}</Text>
          </Pressable>
          <Pressable
            testID="create-account-recover"
            onPress={() => {
              void recover();
            }}
          >
            <Text style={{ color: colors.primary }}>{t('cloud.recover')}</Text>
          </Pressable>
          {notice === 'taken' ? null : (
            <Pressable
              testID="create-account-resend"
              onPress={() => {
                void resend();
              }}
            >
              <Text style={{ color: colors.primary }}>{t('cloud.resendEmail')}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {error ? (
        <Text testID="create-account-error" style={{ color: colors.destructive }}>
          {error}
        </Text>
      ) : null}
      {info ? (
        <Text testID="create-account-info" style={{ color: colors.mutedForeground }}>
          {info}
        </Text>
      ) : null}
      <Pressable testID="create-account-back-signin" onPress={goSignIn}>
        <Text style={{ color: colors.primary }}>{t('account.alreadyHave')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: DesignTokens.spacing.lg,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: DesignTokens.minTouchTarget,
  },
  actions: { gap: 8 },
  btn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: DesignTokens.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
