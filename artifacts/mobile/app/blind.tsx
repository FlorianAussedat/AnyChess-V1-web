import React from 'react';
import {
  BlindSequenceProvider,
  useBlindSequence,
} from '@/contexts/BlindSequenceContext';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { BlindHubPhase } from '@/components/blind/BlindHubPhase';
import { BlindSettingsPhase } from '@/components/blind/BlindSettingsPhase';
import { BlindDictationPhase } from '@/components/blind/BlindDictationPhase';
import { BlindObservingPhase } from '@/components/blind/BlindObservingPhase';
import { BlindReconstructionPhase } from '@/components/blind/BlindReconstructionPhase';
import { BlindRecitationPhase } from '@/components/blind/BlindRecitationPhase';
import { BlindResultsPhase } from '@/components/blind/BlindResultsPhase';

export default function BlindRoute() {
  return (
    <BlindSequenceProvider>
      <BlindSequenceScreen />
    </BlindSequenceProvider>
  );
}

function BlindSequenceScreen() {
  useCancelSpeechOnLeave('/blind');
  const { phase } = useBlindSequence();
  switch (phase) {
    case 'hub':
      return <BlindHubPhase />;
    case 'settings':
    case 'generating':
      return <BlindSettingsPhase />;
    case 'dictation':
      return <BlindDictationPhase />;
    case 'observing':
      return <BlindObservingPhase />;
    case 'reconstruction':
      return <BlindReconstructionPhase />;
    case 'recitation':
      return <BlindRecitationPhase />;
    case 'results':
      return <BlindResultsPhase />;
    default:
      return <BlindHubPhase />;
  }
}
