import React from 'react';
import { OptionChip } from '@/components/ui/OptionChip';

/** Puzzle hub filter chip — shared OptionChip. */
export function PuzzleFilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return <OptionChip label={label} active={active} onPress={onPress} />;
}
