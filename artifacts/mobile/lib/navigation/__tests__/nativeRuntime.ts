export * from '../../theoreticalEndgame/__tests__/uiShims/reactNative.ts';
import { state } from './uiRuntime.ts';
export const Platform = {
  get OS() { return state.platform; },
  select(spec: Record<string, unknown>) { return spec[state.platform] ?? spec.default; },
};
