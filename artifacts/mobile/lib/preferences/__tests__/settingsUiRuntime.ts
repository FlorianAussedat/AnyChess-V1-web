import React from 'react';
import { usePreferences } from '../../../hooks/usePreferences.ts';
import {
  translate,
  type MessageKey,
  type MessageParams,
} from '../../i18n/messages.ts';
import { DesignTokens } from '../../../constants/designTokens.ts';
export {
  useRouter,
  usePathname,
  useNavigation,
  useFocusEffect,
} from '../../navigation/__tests__/uiRuntime.ts';
export const state = {
  platform: 'android' as 'android' | 'web',
  user: null as null | { id: string },
  confirmation: null as null | (() => void),
  stops: 0,
  appliedStrengths: [] as unknown[],
  persisted: new Map<string, any>(),
};
export function useLocalSearchParams() {
  return {};
}
export function useCloudAccount() {
  return { user: state.user, sessionReady: true };
}
export function useAppSafeInsets() {
  return { top: 24, bottom: 24 };
}
export function useColors() {
  return DesignTokens.color;
}
export function useTranslation() {
  const { language } = usePreferences();
  return {
    t: (key: MessageKey, params?: MessageParams) =>
      translate(language, key, params),
  };
}
export function useAudioSettings() {
  const { voiceEnabled, updatePreferences } = usePreferences();
  return {
    voiceEnabled,
    toggleVoice: () => updatePreferences({ voiceEnabled: !voiceEnabled }),
  };
}
export function useBoardCoordinates() {
  const { coordinatesEnabled, updatePreferences } = usePreferences();
  return {
    showCoordinates: coordinatesEnabled,
    toggleCoordinates: () =>
      updatePreferences({ coordinatesEnabled: !coordinatesEnabled }),
  };
}
export function confirmAction(
  _title: string,
  _body: string,
  confirm: () => void,
) {
  state.confirmation = confirm;
}
export function Ionicons(props: object) {
  return React.createElement('Icon', props);
}
export function SoundToggle() {
  return null;
}
export function PgnTranslationSettingsSection() {
  return React.createElement('TranslationSettings');
}
export function PgnTranslationTechnicalDiagnostic() {
  return null;
}
export const speechService = {
  stop() {
    state.stops++;
  },
  cancel() {},
  speak() {},
  onSpeakingChange() {
    return () => {};
  },
};
export function createOpponentEngine() {
  return {
    async init() {},
    cancel() {},
    destroy() {},
    async applyStrength(options: unknown) {
      state.appliedStrengths.push(options);
    },
  };
}
export async function requestOpponentMove() {
  return null;
}
export function usePersistedActivity(args: { kind: string }) {
  state.persisted.set(args.kind, args);
  return { sessionId: 'fixture-session' };
}
export function useActiveSessionBack() {
  return () => {};
}

export function logOpponentMoveDebug() {}
export async function getDocumentAsync() {
  return { canceled: true, assets: null };
}
