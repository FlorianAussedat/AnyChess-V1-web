import { useMemo } from 'react';
import { identifyOpeningFromSans, type OpeningIdentity } from '@/lib/openings';

/**
 * Derive the live opening identity from the current SAN history.
 * Visual-only consumers — never speak or alter game logic.
 */
export function useOpeningIdentity(history: string[]): OpeningIdentity | null {
  return useMemo(() => identifyOpeningFromSans(history), [history]);
}
