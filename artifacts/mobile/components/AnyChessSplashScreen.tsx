/**
 * AnyChess launch intro — shown once when the application starts/reloads.
 *
 * Not part of navigation: returning via Accueil / Back / bottom-nav Home
 * must NOT remount this (it lives only in the root app shell).
 *
 * Layering:
 * 1. Native Expo/Android splash (`app.json` backgroundColor #0B1728)
 * 2. This branded intro (same navy)
 * 3. Home / main menu
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BrandAssets } from '@/constants/BrandAssets';
import { preloadHomeBrandImages } from '@/lib/brand/preloadHomeBrandImages';
import {
  ANYCHESS_NAVY,
  ANYCHESS_TAGLINE,
  EXIT_FADE_DURATION_MS,
  LOGO_FADE_DELAY_MS,
  LOGO_FADE_DURATION_MS,
  LOGO_SCALE_FROM,
  TAGLINE_FADE_DELAY_MS,
  TAGLINE_FADE_DURATION_MS,
  WORDMARK_FADE_DELAY_MS,
  WORDMARK_FADE_DURATION_MS,
  msUntilExitFadeStart,
} from '@/lib/brand/splashTiming';

export type AnyChessSplashScreenProps = {
  /** Fonts / critical boot work finished — wordmark & tagline may animate; exit may start. */
  appReady: boolean;
  /** Called once when the intro has fully faded out. */
  onFinished?: () => void;
  /** Hide the native splash as soon as this view has painted (avoids white flash). */
  onPainted?: () => void;
};

export function AnyChessSplashScreen({
  appReady,
  onFinished,
  onPainted,
}: AnyChessSplashScreenProps) {
  const { width } = useWindowDimensions();
  const [visible, setVisible] = useState(true);

  const introStartedAtMs = useRef(Date.now()).current;
  const appReadyAtMs = useRef<number | null>(null);
  const exitStarted = useRef(false);
  const painted = useRef(false);

  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(LOGO_SCALE_FROM)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  const logoSize = Math.min(200, Math.max(140, Math.round(width * 0.42)));

  // Warm home WebP brand art while the intro plays (from 0.0.4 display-asset work).
  useEffect(() => {
    if (!appReady) return;
    void preloadHomeBrandImages();
  }, [appReady]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        delay: LOGO_FADE_DELAY_MS,
        duration: LOGO_FADE_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        delay: LOGO_FADE_DELAY_MS,
        duration: LOGO_FADE_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoOpacity, logoScale]);

  useEffect(() => {
    if (!appReady) return;
    if (appReadyAtMs.current == null) {
      appReadyAtMs.current = Date.now();
    }

    const elapsed = Date.now() - introStartedAtMs;
    const wordmarkDelay = Math.max(0, WORDMARK_FADE_DELAY_MS - elapsed);
    const taglineDelay = Math.max(0, TAGLINE_FADE_DELAY_MS - elapsed);

    Animated.timing(wordmarkOpacity, {
      toValue: 1,
      delay: wordmarkDelay,
      duration: WORDMARK_FADE_DURATION_MS,
      useNativeDriver: true,
    }).start();

    Animated.timing(taglineOpacity, {
      toValue: 1,
      delay: taglineDelay,
      duration: TAGLINE_FADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [
    appReady,
    introStartedAtMs,
    wordmarkOpacity,
    taglineOpacity,
  ]);

  useEffect(() => {
    if (!appReady || exitStarted.current) return;

    const tick = () => {
      if (exitStarted.current) return;
      const wait = msUntilExitFadeStart({
        introStartedAtMs,
        appReadyAtMs: appReadyAtMs.current,
        nowMs: Date.now(),
      });
      if (wait == null) return;
      if (wait > 16) {
        timeoutId = setTimeout(tick, wait);
        return;
      }

      exitStarted.current = true;
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: EXIT_FADE_DURATION_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setVisible(false);
        onFinished?.();
      });
    };

    let timeoutId = setTimeout(tick, 0);
    return () => clearTimeout(timeoutId);
  }, [appReady, introStartedAtMs, overlayOpacity, onFinished]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[styles.overlay, { opacity: overlayOpacity }]}
      testID="anychess-splash-screen"
      accessibilityLabel="AnyChess"
      onLayout={() => {
        if (painted.current) return;
        painted.current = true;
        onPainted?.();
      }}
    >
      <View style={styles.center}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <Image
            source={BrandAssets.logoMark}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            testID="anychess-splash-logo"
          />
        </Animated.View>

        <Animated.View style={[styles.wordmarkWrap, { opacity: wordmarkOpacity }]}>
          <Text style={styles.wordmark} accessibilityRole="header">
            <Text style={styles.wordmarkAny}>Any</Text>
            <Text style={styles.wordmarkChess}>Chess</Text>
          </Text>
        </Animated.View>

        <Animated.Text
          style={[styles.tagline, { opacity: taglineOpacity }]}
          testID="anychess-splash-tagline"
        >
          {ANYCHESS_TAGLINE}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: ANYCHESS_NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 18,
  },
  wordmarkWrap: {
    marginTop: 4,
  },
  wordmark: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  wordmarkAny: {
    color: '#DCE8F5',
  },
  wordmarkChess: {
    color: '#F5A623',
  },
  tagline: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#5B7FA0',
    textAlign: 'center',
  },
});
