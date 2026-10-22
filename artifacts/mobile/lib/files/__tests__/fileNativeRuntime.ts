export * from '../../theoreticalEndgame/__tests__/uiShims/reactNative.ts';
import React from 'react';
export const Platform = {
  OS: 'android',
  select: <T>(options: { android?: T; default?: T }) =>
    options.android ?? options.default,
};
export const Switch = (props: object) => React.createElement('Switch', props);
export function FlatList(props: any) {
  return React.createElement(
    'FlatList',
    props,
    props.data?.map((item: any, index: number) =>
      React.createElement(
        React.Fragment,
        { key: index },
        props.renderItem({ item, index }),
      ),
    ),
  );
}
