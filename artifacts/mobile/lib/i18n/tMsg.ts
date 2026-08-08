/**
 * Non-React translation helper for contexts / services.
 * Reads the current app language from PreferencesStore.
 */
import { preferencesStore } from '../preferences/PreferencesStore.ts';
import {
  translate,
  type MessageKey,
  type MessageParams,
} from './messages.ts';

export function tMsg(key: MessageKey, params?: MessageParams): string {
  try {
    return translate(preferencesStore.getPreferences().language, key, params);
  } catch {
    return translate('fr', key, params);
  }
}
