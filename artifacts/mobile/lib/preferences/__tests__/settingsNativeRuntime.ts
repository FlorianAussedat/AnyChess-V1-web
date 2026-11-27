export * from '../../theoreticalEndgame/__tests__/uiShims/reactNative.ts';
import { state } from './settingsUiRuntime.ts';
export const Platform = {
  get OS() {
    return state.platform;
  },
  select<T>(options: { android?: T; web?: T; default?: T }) {
    return options[state.platform] ?? options.default;
  },
};
