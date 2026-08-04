import React from 'react';
import { StatRow } from '@/components/ui/StatRow';

/** Blind results — thin wrapper over shared StatRow. */
export function BlindStatRow({ label, value }: { label: string; value: number }) {
  return <StatRow label={label} value={value} />;
}
