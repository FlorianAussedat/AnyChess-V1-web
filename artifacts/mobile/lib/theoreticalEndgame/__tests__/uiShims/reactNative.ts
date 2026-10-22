import React from 'react';

function host(type: string) {
  return function Host(props: { children?: React.ReactNode }) {
    return React.createElement(type, props);
  };
}

export const View = host('View');
export const Text = host('Text');
export const Pressable = host('Pressable');
export const TextInput = host('TextInput');
export const Modal = host('Modal');
export const Image = host('Image');
export const ActivityIndicator = host('ActivityIndicator');
export const StyleSheet = {
  create: (styles: unknown) => styles,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
};
export const ScrollView = host('ScrollView');
export const Animated = {
  Value: class Value {
    current: number;
    constructor(current: number) {
      this.current = current;
    }
    setValue(next: number) {
      this.current = next;
    }
    interpolate(config: { inputRange: number[]; outputRange: number[] }) {
      return { __animated: config };
    }
  },
  View: host('Animated.View'),
  Image: host('Animated.Image'),
  timing() {
    return { start(done?: () => void) { done?.(); } };
  },
  parallel() {
    return { start(done?: () => void) { done?.(); } };
  },
};
export const Platform = {
  select: (spec: { default?: unknown }) => spec.default,
};
const backListeners = new Set<() => boolean | null | undefined>();
export const BackHandler = {
  addEventListener(_name: string, listener: () => boolean | null | undefined) {
    backListeners.add(listener);
    return {
      remove() {
        backListeners.delete(listener);
      },
    };
  },
  listeners: backListeners,
};
export function useWindowDimensions() {
  return { width: 390, height: 844, scale: 2, fontScale: 1 };
}

export const KeyboardAvoidingView = host('KeyboardAvoidingView');
