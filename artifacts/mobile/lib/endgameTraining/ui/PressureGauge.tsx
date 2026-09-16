/**
 * Pressure gauge — green at 0.00 → red at −2.00 (player POV).
 * Delegates to UniversalEvalGauge (pressure band).
 */
import React from 'react';
import { UniversalEvalGauge } from '@/lib/evaluation/UniversalEvalGauge.tsx';

type Props = {
  scoreCp: number;
  mateIn?: number | null;
  visible: boolean;
  /** Player/defender perspective for the gauge. */
  perspective?: 'white' | 'black';
  testID?: string;
};

export function PressureGauge({
  scoreCp,
  mateIn = null,
  visible,
  perspective = 'white',
  testID,
}: Props) {
  return (
    <UniversalEvalGauge
      scoreCp={scoreCp}
      mateIn={mateIn}
      perspective={perspective}
      scoreIsPerspectivePov
      visible={visible}
      mode="pressure"
      testID={testID ?? 'endgame-pressure-gauge'}
    />
  );
}
