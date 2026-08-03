import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BrandSplash } from '@/components/BrandSplash';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { audioSettings } from '@/services/AudioSettings';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Root navigator. Each game mode is its own route with its own isolated
 * logic/state (GameProvider is scoped per-mode, not global), so modes never
 * accidentally share state.
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

  const appReady = Boolean(fontsLoaded || fontError);

  useEffect(() => {
    audioSettings.ensureLoaded().catch(() => {});
  }, []);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <View style={styles.root}>
                <RootLayoutNav />
                <BrandSplash ready={appReady} />
              </View>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
