import React, { useMemo } from 'react';
import { DiscreteSlider } from '@/components/ui/DiscreteSlider';
import {
  PUZZLE_RATING_BANDS_SELECTABLE,
  PUZZLE_RATING_SLIDER_NEUTRAL_INDEX,
} from '@/lib/puzzles';

type Props = {
  bandId: string;
  onBandIdChange: (bandId: string) => void;
  label?: string;
  testID?: string;
};

/**
 * Discrete Lichess puzzle-rating picker — one snap stop per Elo band.
 * « Aléatoire / Tous » is a separate OptionChip, not a slider stop.
 */
export function PuzzleRatingBandSlider({
  bandId,
  onBandIdChange,
  label = 'Difficulté',
  testID = 'puzzle-rating-band-slider',
}: Props) {
  const index = useMemo(() => {
    const i = PUZZLE_RATING_BANDS_SELECTABLE.findIndex((b) => b.id === bandId);
    if (i >= 0) return i;
    const neutral = PUZZLE_RATING_SLIDER_NEUTRAL_INDEX;
    return neutral >= 0 ? neutral : 0;
  }, [bandId]);

  const band =
    PUZZLE_RATING_BANDS_SELECTABLE.find((b) => b.id === bandId) ??
    PUZZLE_RATING_BANDS_SELECTABLE[index] ??
    PUZZLE_RATING_BANDS_SELECTABLE[0]!;

  const valueLabel =
    bandId === 'all' ? 'Aléatoire / Tous' : band.label;

  const first = PUZZLE_RATING_BANDS_SELECTABLE[0]!;
  const last = PUZZLE_RATING_BANDS_SELECTABLE[PUZZLE_RATING_BANDS_SELECTABLE.length - 1]!;

  return (
    <DiscreteSlider
      testID={testID}
      label={label}
      valueLabel={valueLabel}
      minimumValue={0}
      maximumValue={PUZZLE_RATING_BANDS_SELECTABLE.length - 1}
      step={1}
      value={index}
      onValueChange={(next) => {
        const picked = PUZZLE_RATING_BANDS_SELECTABLE[next];
        if (picked) onBandIdChange(picked.id);
      }}
      leftHint={first.label}
      rightHint={last.label}
      accessibilityLabel={`${label} : ${valueLabel}`}
    />
  );
}
