import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AnyChessSplashScreen } from '@/components/AnyChessSplashScreen';
import { NavigationShell } from '@/components/navigation/NavigationShell';
import { AppDialogHost } from '@/components/ui/AppDialogHost';
import { OfflineModelBanner } from '@/components/speech/OfflineModelBanner';
import { ANYCHESS_NAVY } from '@/lib/brand/splashTiming';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { holdNativeSplash } from '@/lib/brand/holdNativeSplash';
import { preferencesStore } from '@/lib/preferences';
import { bindCloudLifecycle, getActiveCloudEngine, hydrateCloudSession } from '@/lib/cloud';
import {
  installPersonalPgnGuard,
  personalPgnWritesBlocked,
  PersonalPgnAccessError,
} from '@/lib/repertoire/personalPgnAccess';
import { tMsg } from '@/lib/i18n';
import { runStorageMigrations } from '@/lib/storage';
import { loadActivitySessions } from '@/lib/activitySessions';
import {
  bindPgnTranslationLifecycle,
  reconcilePgnTranslationAfterBoot,
} from '@/lib/pgnComments';
import { useReleaseEphemeralOpeningSession } from '@/hooks/useReleaseEphemeralOpeningSession';

holdNativeSplash();

const queryClient = new QueryClient();

/**
 * Root navigator. Each game mode is its own route with its own isolated
 * logic/state (GameProvider is scoped per-mode, not global), so modes never
 * accidentally share state.
 *
 * Main navigation is rendered in normal flow by NavigationShell, only on
 * the four main routes after the launch intro. Activity providers stay isolated.
 *
 * Launch intro (`AnyChessSplashScreen`) is mounted once here — never on the
 * Home route — so Accueil / Back / bottom-nav Home do not replay it.
 */
function RootLayoutNav() {
  useReleaseEphemeralOpeningSession();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="classic" />
      <Stack.Screen name="openings" />
      <Stack.Screen name="blind" />
      <Stack.Screen name="puzzles" />
      <Stack.Screen name="visualisation" />
      <Stack.Screen name="quiz-ouverture" />
      <Stack.Screen name="parties" />
      <Stack.Screen name="records" />
      <Stack.Screen name="utilisateur" />
      <Stack.Screen name="creer-compte" />
      <Stack.Screen name="parametres" />
      <Stack.Screen name="profil" />
      {typeof __DEV__ !== 'undefined' && __DEV__ ? (
        <Stack.Screen name="dev/voice-parser" options={{ headerShown: true }} />
      ) : null}
      {typeof __DEV__ !== 'undefined' && __DEV__ ? (
        <Stack.Screen name="dev/stockfish-uci" options={{ headerShown: true }} />
      ) : null}
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
    ...Feather.font,
  });

  const [prefsHydrated, setPrefsHydrated] = useState(() =>
    preferencesStore.isHydrated(),
  );
  const appReady = Boolean(fontsLoaded || fontError) && prefsHydrated;
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    installPersonalPgnGuard(() => {
      const state = getActiveCloudEngine().getState();
      if (!personalPgnWritesBlocked(state)) return;
      throw new PersonalPgnAccessError(tMsg('openings.accountRequiredTitle'));
    });
    return () => installPersonalPgnGuard(null);
  }, []);

  useEffect(() => {
    runStorageMigrations().catch(() => {});
    void loadActivitySessions().catch(() => {});
    preferencesStore
      .ensureLoaded()
      .then(() => {
        setPrefsHydrated(true);
        bindCloudLifecycle();
        void hydrateCloudSession().catch(error=>getActiveCloudEngine().noteBackgroundFailure('boot.cloud_hydrate',error)).finally(() => {
          bindPgnTranslationLifecycle();
          void reconcilePgnTranslationAfterBoot().catch(error=>getActiveCloudEngine().noteBackgroundFailure('boot.translation_reconcile',error));
        }).catch(error=>getActiveCloudEngine().noteBackgroundFailure('boot.cloud_finally',error));
      })
      .catch(() => setPrefsHydrated(true));
  }, []);

  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const onIntroFinished = useCallback(() => {
    setIntroDone(true);
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <View style={styles.root}>
                <StatusBar style="light" backgroundColor={ANYCHESS_NAVY} />
                {appReady ? (
                  <NavigationShell introDone={introDone}>
                    <RootLayoutNav />
                  </NavigationShell>
                ) : (
                  <View style={styles.bootBridge} testID="anychess-boot-bridge" />
                )}

                {/* The shell shows navigation only after the intro finishes. */}
                {appReady ? <OfflineModelBanner /> : null}
                {appReady ? <AppDialogHost /> : null}

                {!introDone ? (
                  <AnyChessSplashScreen
                    appReady={appReady}
                    onPainted={hideNativeSplash}
                    onFinished={onIntroFinished}
                  />
                ) : null}
              </View>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ANYCHESS_NAVY,
  },
  content: {
    flex: 1,
    backgroundColor: ANYCHESS_NAVY,
  },
  bootBridge: {
    flex: 1,
    backgroundColor: ANYCHESS_NAVY,
  },
});
