import { useCallback } from 'react';
import { usePreferences } from './usePreferences';
import type { ChessInputMode } from '@/lib/preferences';

/** Persisted Classic vs keypad mode — shared with Partie classique. */
export function useChessInputMode() {
  const { chessInputMode, updatePreferences } = usePreferences();

  const setChessInputMode = useCallback(
    async (mode: ChessInputMode) => {
      await updatePreferences({ chessInputMode: mode });
    },
    [updatePreferences],
  );

  const toggleChessInputMode = useCallback(async () => {
    const next: ChessInputMode = chessInputMode === 'classic' ? 'keypad' : 'classic';
    await setChessInputMode(next);
  }, [chessInputMode, setChessInputMode]);

  return {
    inputMode: chessInputMode,
    setChessInputMode,
    toggleChessInputMode,
    keypadActive: chessInputMode === 'keypad',
  };
}
