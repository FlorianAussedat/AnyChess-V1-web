import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { BrandAssets } from '@/constants/BrandAssets';

const SPLASH_HOLD_MS = 2000;
const SPLASH_FADE_MS = 700;

type Props = {
  /** When true, splash may start (fonts ready, etc.). */
  ready: boolean;
  onFinished?: () => void;
};

/**
 * Full-screen branded intro: logo + wordmark for 2s, then gentle fade to the app.
 */
export function BrandSplash({ ready, onFinished }: Props) {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;

    const hold = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: SPLASH_FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setVisible(false);
          onFinished?.();
        }
      });
    }, SPLASH_HOLD_MS);

    return () => clearTimeout(hold);
  }, [ready, opacity, onFinished]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { opacity }]}
      testID="brand-splash"
    >
      <View style={styles.center}>
        <Image
          source={BrandAssets.splash}
          style={styles.splashImage}
          resizeMode="contain"
          accessibilityLabel="AnyChess"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: '#0B1728',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  splashImage: {
    width: '88%',
    maxWidth: 420,
    height: '72%',
    maxHeight: 640,
  },
});
