import { useCallback } from 'react';
import { translate, type MessageKey } from '@/lib/i18n';
import { usePreferences } from './usePreferences';

export function useTranslation() {
  const { language, isPreferencesHydrated } = usePreferences();
  const t = useCallback(
    (key: MessageKey) => translate(language, key),
    [language],
  );
  return { t, language, isPreferencesHydrated };
}
