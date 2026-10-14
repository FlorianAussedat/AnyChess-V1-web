import React from 'react';

function host(type: string) {
  return function Host(props: { children?: React.ReactNode }) {
    return React.createElement(type, props);
  };
}

export function Svg(props: { children?: React.ReactNode }) {
  return React.createElement('Svg', props);
}
export function Line(props: { children?: React.ReactNode }) {
  return React.createElement('Line', props);
}
export const Defs = host('Defs');
export const Marker = host('Marker');
export const Path = host('Path');
export default Svg;
