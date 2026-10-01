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
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AvatarField } from '@/components/profile/AvatarField';
import { DesignTokens } from '@/constants/designTokens';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useColors } from '@/hooks/useColors';
import { useCloudAccount } from '@/hooks/useCloudAccount';
import { useTranslation } from '@/hooks/useTranslation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { AUTH_ERROR_KEYS } from '@/components/cloud/CloudAccountSection';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pseudoEdited) return;
    if (profile.username && !pseudo) setPseudo(profile.username);
  }, [profile.username, pseudo, pseudoEdited]);

  const goSignIn = () => {
    router.replace('/utilisateur');
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await submitCreateAccount({
      username: pseudo,
      email,
      password,
      avatarDataUrl: avatar,
      storage: defaultKeyValueStorage,
      updateUsername: async (username) => {
        await updateProfile({ username });
      },
      signUp: (nextEmail, nextPassword) => cloud.signUp(nextEmail, nextPassword),
    });
    setBusy(false);
    if (result.ok || result.error === 'confirm_email') {
      router.replace('/utilisateur');
      return;
    }
    if (result.error === 'username_required') {
      setError(t('account.usernameRequired'));
      return;
    }
    const key = AUTH_ERROR_KEYS[(result.error as CloudAuthError) ?? 'unexpected'] ?? 'cloud.errorUnexpected';
    setError(t(key));
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
        imageUri={avatar}
        onChange={setAvatar}
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
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder={t('cloud.email')}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
      />
      <TextInput
        testID="create-account-password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        placeholder={t('cloud.password')}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
      />
      <Pressable
        testID="create-account-password-toggle"
        onPress={() => setShowPassword((value) => !value)}
      >
        <Text style={{ color: colors.primary }}>
          {showPassword ? t('account.hidePassword') : t('account.showPassword')}
        </Text>
      </Pressable>
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
      {error ? (
        <Text testID="create-account-error" style={{ color: colors.destructive }}>
          {error}
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
