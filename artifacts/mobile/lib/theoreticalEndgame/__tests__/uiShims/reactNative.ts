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
export const StyleSheet = { create: (styles: unknown) => styles };
export const Platform = {
  select: (spec: { default?: unknown }) => spec.default,
};
export function useWindowDimensions() {
  return { width: 390, height: 844, scale: 2, fontScale: 1 };
}
