/** Probe the existing Expo native module; missing APIs are reported without adding a dependency. */
export type NativeFiles = {
  requestDirectoryPermissionsAsync?: (
    initial: string | null,
  ) => Promise<{ granted: boolean; directoryUri?: string }>;
  createSAFFileAsync?: (
    directory: string,
    filename: string,
    mime: string,
  ) => Promise<string>;
  writeAsStringAsync?: (
    uri: string,
    text: string,
    options: { encoding: string },
  ) => Promise<void>;
  readAsStringAsync?: (
    uri: string,
    options: { encoding: string },
  ) => Promise<string>;
  getInfoAsync?: (
    uri: string,
    options: object,
  ) => Promise<{ exists: boolean; size?: number }>;
  deleteAsync?: (
    uri: string,
    options: { idempotent: boolean },
  ) => Promise<void>;
};
export function nativeFiles(): NativeFiles | null {
  try {
    const core = require('expo-modules-core') as {
      requireOptionalNativeModule: (name: string) => NativeFiles | null;
    };
    return core.requireOptionalNativeModule('ExponentFileSystem');
  } catch {
    return null;
  }
}
