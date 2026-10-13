import { LogBox, Platform } from 'react-native';

/**
 * Expo Router 6 (SDK 54) logs this from `useLinking` whenever Android
 * remounts the root (dev-client connect, activity recreation). A later
 * expo-router release stops emitting it on Android (expo/expo#42644).
 * The check is dev-only and does not change navigation.
 */
export const ANDROID_DEV_LINKING_WARNING =
  'Looks like you have configured linking in multiple places';

if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'android') {
  LogBox.ignoreLogs([ANDROID_DEV_LINKING_WARNING]);
}
