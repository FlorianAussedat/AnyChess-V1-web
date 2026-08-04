import React from 'react';
import { StatRow } from '@/components/ui/StatRow';

/** Puzzle results — thin wrapper over shared StatRow. */
export function PuzzleStatRow({ label, value }: { label: string; value: string }) {
  return <StatRow label={label} value={value} />;
}
