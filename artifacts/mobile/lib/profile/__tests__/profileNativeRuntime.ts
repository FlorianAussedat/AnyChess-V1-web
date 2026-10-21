export * from '../../theoreticalEndgame/__tests__/uiShims/reactNative.ts';
import React, { useImperativeHandle } from 'react';
import { state } from './profileUiRuntime.ts';
export const ScrollView = React.forwardRef((props: object, ref) => {
  useImperativeHandle(ref, () => ({
    scrollTo: (value: unknown) => {
      state.scroll = value;
    },
  }));
  return React.createElement('ScrollView', props);
});
