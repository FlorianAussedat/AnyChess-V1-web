import React, { useMemo } from 'react';
import { DiscreteSlider } from '@/components/ui/DiscreteSlider';
import {
  STOCKFISH_STRENGTH_BANDS,
  DEFAULT_STRENGTH_BAND_ID,
} from '@/lib/difficulty/StockfishStrengthBands';

type Props = {
  bandId: string;
  onBandIdChange: (bandId: string) => void;
  label?: string;
  testID?: string;
};

/**
 * Discrete Stockfish strength picker — one snap stop per rating band.
 */
export function StrengthBandSlider({
  bandId,
  onBandIdChange,
  label = 'Niveau adversaire',
  testID = 'strength-band-slider',
}: Props) {
  const index = useMemo(() => {
    const i = STOCKFISH_STRENGTH_BANDS.findIndex((b) => b.id === bandId);
    if (i >= 0) return i;
    const fallback = STOCKFISH_STRENGTH_BANDS.findIndex((b) => b.id === DEFAULT_STRENGTH_BAND_ID);
    return Math.max(0, fallback);
  }, [bandId]);

  const band = STOCKFISH_STRENGTH_BANDS[index] ?? STOCKFISH_STRENGTH_BANDS[0]!;

  return (
    <DiscreteSlider
      testID={testID}
      label={label}
      valueLabel={band.label}
      minimumValue={0}
      maximumValue={STOCKFISH_STRENGTH_BANDS.length - 1}
      step={1}
      value={index}
      onValueChange={(next) => {
        const picked = STOCKFISH_STRENGTH_BANDS[next];
        if (picked) onBandIdChange(picked.id);
      }}
      accessibilityLabel={`${label} : ${band.label}`}
    />
  );
}
