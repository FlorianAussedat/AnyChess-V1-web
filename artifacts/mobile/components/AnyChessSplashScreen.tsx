/**
 * AnyChess launch intro — shown once when the application starts/reloads.
 *
 * Not part of navigation: returning via Accueil / Back / bottom-nav Home
 * must NOT remount this (it lives only in the root app shell).
 *
 * Layering:
 * 1. Native Expo/Android splash (`app.json` backgroundColor #0B1728)
 * 2. This branded intro (same navy) — one complete artwork fade
 * 3. Home / main menu + bottom nav, prepared underneath
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { BrandAssets } from '@/constants/BrandAssets';
import {
  LAUNCH_PORTRAIT_ART,
  LAUNCH_PORTRAIT_CANVAS,
  artHeight,
  artWidth,
} from '@/constants/brandArtBounds';
import { preloadHomeBrandImages } from '@/lib/brand/preloadHomeBrandImages';
import { useTranslation } from '@/hooks/useTranslation';
import {
  ANYCHESS_NAVY,
  ENTER_FADE_DURATION_MS,
  EXIT_FADE_DURATION_MS,
  msUntilExitFadeStart,
} from '@/lib/brand/splashTiming';

export type AnyChessSplashScreenProps = {
  appReady: boolean;
  onFinished?: () => void;
  /** Hide the native splash only after the launch artwork has loaded and laid out. */
  onPainted?: () => void;
};

export function AnyChessSplashScreen({
  appReady,
  onFinished,
  onPainted,
}: AnyChessSplashScreenProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const [introStartedAtMs, setIntroStartedAtMs] = useState<number | null>(null);
  const appReadyAtMs = useRef<number | null>(null);
  const exitStarted = useRef(false);
  const laidOut = useRef(false);
  const imageLoaded = useRef(false);
  const painted = useRef(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const artOpacity = useRef(new Animated.Value(0)).current;

  const artW = artWidth(LAUNCH_PORTRAIT_ART);
  const artH = artHeight(LAUNCH_PORTRAIT_ART);
  const visibleW = Math.min(360, Math.max(260, Math.round(width * 0.82)));
  const visibleH = Math.round(visibleW * (artH / artW));
  const imgW = Math.round(visibleW / artW);
  const imgH = Math.round(imgW * (LAUNCH_PORTRAIT_CANVAS.height / LAUNCH_PORTRAIT_CANVAS.width));
  const imgLeft = -Math.round(LAUNCH_PORTRAIT_ART.left * imgW);
  const imgTop = -Math.round(LAUNCH_PORTRAIT_ART.top * imgH);

  const showArtwork = useCallback(() => {
    if (!laidOut.current || !imageLoaded.current || painted.current) return;
    painted.current = true;
    setIntroStartedAtMs(Date.now());
    onPainted?.();
    Animated.timing(artOpacity, {
      toValue: 1,
      duration: ENTER_FADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [artOpacity, onPainted]);

  useEffect(() => {
    if (appReadyAtMs.current == null && appReady) {
      appReadyAtMs.current = Date.now();
    }
    if (appReady) void preloadHomeBrandImages();
  }, [appReady]);

  useEffect(() => {
    if (!appReady || introStartedAtMs == null || exitStarted.current) return;

    const wait = msUntilExitFadeStart({
      introStartedAtMs,
      appReadyAtMs: appReadyAtMs.current,
      nowMs: Date.now(),
    });
    if (wait == null) return;

    const timeoutId = setTimeout(() => {
      if (exitStarted.current) return;
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
    }, Math.max(0, wait));
    return () => clearTimeout(timeoutId);
  }, [appReady, introStartedAtMs, overlayOpacity, onFinished]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[styles.overlay, { opacity: overlayOpacity }]}
      testID="anychess-splash-screen"
      accessibilityLabel={`AnyChess. ${t('home.tagline')}`}
      onLayout={() => {
        laidOut.current = true;
        showArtwork();
      }}
    >
      <Animated.View
        style={[
          styles.artViewport,
          { width: visibleW, height: visibleH, opacity: artOpacity },
        ]}
      >
        <Image
          source={BrandAssets.splash}
          style={{
            position: 'absolute',
            left: imgLeft,
            top: imgTop,
            width: imgW,
            height: imgH,
          }}
          resizeMode="stretch"
          accessibilityIgnoresInvertColors
          testID="anychess-splash-logo"
          onLoadEnd={() => {
            imageLoaded.current = true;
            showArtwork();
          }}
        />
      </Animated.View>
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
  artViewport: {
    overflow: 'hidden',
    position: 'relative',
  },
});
