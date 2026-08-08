import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AnyChessSplashScreen } from '@/components/AnyChessSplashScreen';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { DesignTokens } from '@/constants/designTokens';
import { ANYCHESS_NAVY } from '@/lib/brand/splashTiming';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { preferencesStore } from '@/lib/preferences';
import { runStorageMigrations } from '@/lib/storage';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Root navigator. Each game mode is its own route with its own isolated
 * logic/state (GameProvider is scoped per-mode, not global), so modes never
 * accidentally share state.
 *
 * Persistent bottom navigation is rendered by the app shell (not a second
 * router). Content is inset by `bottomNavContentHeight` so boards/controls
 * are never hidden under the bar; per-screen safe-area padding is unchanged.
 *
 * Launch intro (`AnyChessSplashScreen`) is mounted once here — never on the
 * Home route — so Accueil / Back / bottom-nav Home do not replay it.
 */
function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="classic" />
      <Stack.Screen name="openings" />
      <Stack.Screen name="blind" />
      <Stack.Screen name="puzzles" />
      <Stack.Screen name="visualisation" />
      <Stack.Screen name="quiz-ouverture" />
      <Stack.Screen name="records" />
      <Stack.Screen name="profil" />
      {typeof __DEV__ !== 'undefined' && __DEV__ ? (
        <Stack.Screen name="dev/voice-parser" options={{ headerShown: true }} />
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
  });

  const [prefsHydrated, setPrefsHydrated] = useState(() =>
    preferencesStore.isHydrated(),
  );
  const appReady = Boolean(fontsLoaded || fontError) && prefsHydrated;
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    runStorageMigrations().catch(() => {});
    preferencesStore
      .ensureLoaded()
      .then(() => setPrefsHydrated(true))
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
                  <View
                    style={[
                      styles.content,
                      {
                        paddingBottom: introDone
                          ? DesignTokens.bottomNavContentHeight
                          : 0,
                      },
                    ]}
                  >
                    <RootLayoutNav />
                  </View>
                ) : (
                  <View style={styles.bootBridge} testID="anychess-boot-bridge" />
                )}

                {/* Nav only after launch intro — never drawn over the splash. */}
                {appReady && introDone ? <BottomNavigation /> : null}

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
