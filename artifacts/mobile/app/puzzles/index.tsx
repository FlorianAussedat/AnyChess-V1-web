import React from 'react';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { PuzzleProvider, usePuzzle } from '@/contexts/PuzzleContext';
import { PuzzleHubPhase } from '@/components/puzzles/PuzzleHubPhase';
import { PuzzleSettingsPhase } from '@/components/puzzles/PuzzleSettingsPhase';
import { PuzzlePlayingPhase } from '@/components/puzzles/PuzzlePlayingPhase';
import { PuzzleResultsPhase } from '@/components/puzzles/PuzzleResultsPhase';

export default function PuzzlesRoute() {
  return (
    <PuzzleProvider>
      <PuzzlesScreen />
    </PuzzleProvider>
  );
}

function PuzzlesScreen() {
  useCancelSpeechOnLeave('/puzzles');
  const { phase } = usePuzzle();
  switch (phase) {
    case 'hub':
      return <PuzzleHubPhase />;
    case 'settings':
      return <PuzzleSettingsPhase />;
    case 'playing':
    case 'solution-replay':
      return <PuzzlePlayingPhase />;
    case 'results':
      return <PuzzleResultsPhase />;
    default:
      return <PuzzleHubPhase />;
  }
}
