import React, { useEffect, useState } from 'react';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { ProfileStore } from '../ProfileStore.ts';
import { DesignTokens } from '../../../constants/designTokens.ts';
import {
  translate,
  type MessageKey,
  type MessageParams,
} from '../../i18n/messages.ts';
export {
  useRouter,
  usePathname,
  useNavigation,
  useFocusEffect,
} from '../../navigation/__tests__/uiRuntime.ts';
export const defaultKeyValueStorage = new MemoryKeyValueStorage();
export const state = {
  store: new ProfileStore(defaultKeyValueStorage),
  user: { id: 'account-a', email: 'ada@example.com' } as null | {
    id: string;
    email: string;
  },
  ready: true,
  language: 'fr' as 'fr' | 'en',
  scroll: null as unknown,
};
export function useUserProfile() {
  const [profile, setProfile] = useState(() => state.store.getProfile());
  useEffect(() => state.store.onChange(setProfile), []);
  return {
    profile,
    ready: true,
    updateProfile: (patch: Parameters<ProfileStore['update']>[0]) =>
      state.store.update(patch),
  };
}
export function useCloudAccount() {
  return { user: state.user, sessionReady: state.ready };
}
export function useAppSafeInsets() {
  return { top: 24, bottom: 24 };
}
export function useTranslation() {
  return {
    t: (key: MessageKey, params?: MessageParams) =>
      translate(state.language, key, params),
  };
}
export function useColors() {
  return DesignTokens.color;
}
export const repertoireService = {
  ensureLoaded: async () => {},
  getFolders: () => [{ id: 'folder' }],
};
export const RECORDS_CATEGORIES = [{ id: 'first' }, { id: 'second' }];
export async function countActiveRecordCategories() {
  return 1;
}
export async function resetAllCatalogRecords() {}
export const cloudSyncEngine = {
  getAccessToken: () => null,
  markOffline() {},
};
export function Ionicons(props: object) {
  return React.createElement('Icon', props);
}
export function SoundToggle() {
  return null;
}
// Layout tests keep the established account widget as a slot. Its real behavior is covered by cloud tests.
export function CloudAccountSection() {
  return React.createElement('AccountSection', {
    testID: 'existing-account-widget',
  });
}
