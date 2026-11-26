import React from 'react';
import {
  translate,
  type MessageKey,
  type MessageParams,
} from '../../i18n/messages.ts';
import { DesignTokens } from '../../../constants/designTokens.ts';
export { formatPgnGameIndexTitle } from '../../gameLibrary/indexPgnGamesLight.ts';
export {
  MAX_PGN_IMPORT_BATCH,
  MAX_OPENINGS_PGN_IMPORT_BATCH,
} from '../../gameLibrary/displayNameFromFilename.ts';
export const state = {
  language: 'fr' as 'fr' | 'en',
  cancelled: false,
  assets: [] as any[],
  pickerOptions: null as any,
};
export async function getDocumentAsync(options: unknown) {
  state.pickerOptions = options;
  return { canceled: state.cancelled, assets: state.assets };
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
export function Ionicons(props: object) {
  return React.createElement('Icon', props);
}
