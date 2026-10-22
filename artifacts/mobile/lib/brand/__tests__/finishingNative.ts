export * from '../../theoreticalEndgame/__tests__/uiShims/reactNative.ts';
export const dimensions = { width: 320, height: 480, scale: 2, fontScale: 2 };
export function useWindowDimensions() {
  return dimensions;
}
