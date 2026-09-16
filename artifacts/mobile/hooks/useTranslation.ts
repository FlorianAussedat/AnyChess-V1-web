import { useCallback } from 'react';
import {
  translate,
  type MessageKey,
  type MessageParams,
} from '@/lib/i18n';
import { usePreferences } from './usePreferences';

export function useTranslation() {
  const { language, isPreferencesHydrated } = usePreferences();
  const t = useCallback(
    (key: MessageKey, params?: MessageParams) =>
      translate(language, key, params),
    [language],
  );
  return { t, language, isPreferencesHydrated };
}
