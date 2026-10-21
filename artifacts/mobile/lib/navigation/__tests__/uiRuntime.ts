import React, { useEffect } from 'react';
import { translate, type MessageKey } from '../../i18n/messages.ts';
import { DesignTokens } from '../../../constants/designTokens.ts';

export const state = {
  platform: 'android' as 'android' | 'web',
  path: '/', language: 'fr' as 'fr' | 'en', safeBottom: 24,
  sessionReady: true, user: null as null | { id: string },
  stack: ['/'],
};
export const router = {
  canGoBack: () => state.stack.length > 1,
  back: () => { state.stack.pop(); state.path = state.stack.at(-1) ?? '/'; },
  replace: (path: string) => { state.stack[state.stack.length - 1] = path; state.path = path; },
  push: (path: string) => { state.stack.push(path); state.path = path; },
};
export function useRouter() { return router; }
export function usePathname() { return state.path; }
export function useFocusEffect(effect: () => void | (() => void)) { useEffect(effect, [effect]); }
export function useCloudAccount() { return { user: state.user, sessionReady: state.sessionReady }; }
export function useAppSafeInsets() { return { top: 24, bottom: state.safeBottom, left: 0, right: 0 }; }
export function useTranslation() { return { t: (key: MessageKey) => translate(state.language, key) }; }
export function useColors() { return DesignTokens.color; }
export const BrandAssets = { navHome: 'nav-home' };
export function Image(props: object) { return React.createElement('Image', props); }
export const Ionicons = Image;
export function SoundToggle() { return null; }

export const removalListeners = new Set<(event: { preventDefault(): void }) => void>();
const navigation = { addListener(_name: string, listener: (event: { preventDefault(): void }) => void) { removalListeners.add(listener); return () => { removalListeners.delete(listener); }; } };
export function useNavigation() { return navigation; }
