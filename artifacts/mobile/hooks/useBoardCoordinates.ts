import { useCallback, useEffect, useState } from 'react';
import { boardCoordinatesSettings } from '@/services/BoardCoordinatesSettings';

/** React mirror of the global board-coordinates visibility preference. */
export function useBoardCoordinates() {
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    boardCoordinatesSettings.ensureLoaded().then(() => {
      if (!cancelled) {
        setShowCoordinates(boardCoordinatesSettings.isCoordinatesVisible());
        setReady(true);
      }
    });
    const unsub = boardCoordinatesSettings.onChange((visible) => {
      setShowCoordinates(visible);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const toggleCoordinates = useCallback(async () => {
    return boardCoordinatesSettings.toggleCoordinates();
  }, []);

  const setCoordinatesVisible = useCallback(async (visible: boolean) => {
    await boardCoordinatesSettings.setCoordinatesVisible(visible);
  }, []);

  return {
    showCoordinates,
    ready,
    toggleCoordinates,
    setCoordinatesVisible,
  };
}
