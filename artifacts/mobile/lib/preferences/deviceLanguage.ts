/**
 * First-launch language: the phone locale when AnyChess supports it, otherwise English.
 * A language already stored on the device is never replaced by this helper.
 */
import type { AppLanguage } from './types.ts';

export const APP_LANGUAGE_OPTIONS: readonly { id: AppLanguage; nativeName: string }[] = [
  { id: 'fr', nativeName: 'Français' },
  { id: 'en', nativeName: 'English' },
];

export function appLanguageFromTag(tag: string | null | undefined): AppLanguage {
  const code = (tag ?? '')
    .trim()
    .toLowerCase()
    .replace('_', '-')
    .split('-')[0];
  if (code === 'fr' || code === 'en') return code;
  return 'en';
}

function readExpoLocale(): string | null {
  try {
    const Localization = require('expo-localization') as {
      getLocales?: () => { languageCode?: string | null; languageTag?: string | null }[];
      locale?: string;
    };
    const first = Localization.getLocales?.()?.[0];
    if (first?.languageCode) return first.languageCode;
    if (first?.languageTag) return first.languageTag;
    if (typeof Localization.locale === 'string' && Localization.locale) return Localization.locale;
  } catch {
    /* optional dependency */
  }
  return null;
}

function readReactNativeLocale(): string | null {
  if (typeof navigator === 'undefined' || navigator.product !== 'ReactNative') return null;
  try {
    const { NativeModules, Platform } = require('react-native') as {
      Platform: { OS: string };
      NativeModules: {
        SettingsManager?: { settings?: { AppleLocale?: string; AppleLanguages?: string[] } };
        I18nManager?: { localeIdentifier?: string };
      };
    };
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      return settings?.AppleLocale ?? settings?.AppleLanguages?.[0] ?? null;
    }
    return NativeModules.I18nManager?.localeIdentifier ?? null;
  } catch {
    return null;
  }
}

/** Phone language tag, or null when the runtime cannot report one. */
export function readDeviceLanguageTag(): string | null {
  return (
    readExpoLocale() ??
    readReactNativeLocale() ??
    (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().locale || null;
      } catch {
        return null;
      }
    })()
  );
}

export function languageFromDevice(): AppLanguage {
  return appLanguageFromTag(readDeviceLanguageTag());
}
