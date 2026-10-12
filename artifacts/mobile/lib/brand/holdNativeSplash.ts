/**
 * expo-splash-screen holds the native splash with expo-keep-awake.
 * On Android that activation throws "Unable to activate keep awake" when the
 * current activity is not ready yet. The promise must be caught, the cause
 * logged, and the hold retried once the app is active.
 */
import { AppState } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const MAX_ATTEMPTS = 3;
let attempts = 0;
let listening = false;
let held = false;

async function attemptHold(): Promise<void> {
  if (held || attempts >= MAX_ATTEMPTS) return;
  attempts += 1;
  try {
    await SplashScreen.preventAutoHideAsync();
    held = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[AnyChess] keep awake / splash hold failed (${attempts}/${MAX_ATTEMPTS}): ${message}`,
    );
    if (!listening && attempts < MAX_ATTEMPTS) {
      listening = true;
      const sub = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        void attemptHold().finally(() => {
          if (held || attempts >= MAX_ATTEMPTS) {
            try {
              sub.remove();
            } catch {
              /* listener already gone */
            }
          }
        });
      });
    }
  }
}

export function holdNativeSplash(): void {
  void attemptHold();
}
