/**
 * Host for result-screen overlays (analysis, finish-game).
 */
import React from 'react';
import { AnalysisOverlay } from './AnalysisOverlay';
import { FinishGameOverlay } from './FinishGameOverlay';
import type {
  FinishGamePayload,
  ReviewLaunchPayload,
} from '@/lib/review/ReviewSessionRegistry';

export type ResultOverlayKind = null | 'analysis' | 'finish-game';

type Props = {
  overlay: ResultOverlayKind;
  analysisPayload: ReviewLaunchPayload | null;
  finishPayload: FinishGamePayload | null;
  onCloseOverlay: () => void;
};

export function ExerciseResultOverlayHost({
  overlay,
  analysisPayload,
  finishPayload,
  onCloseOverlay,
}: Props) {
  return (
    <>
      {analysisPayload && (
        <AnalysisOverlay
          visible={overlay === 'analysis'}
          payload={analysisPayload}
          onClose={onCloseOverlay}
        />
      )}
      {finishPayload && (
        <FinishGameOverlay
          visible={overlay === 'finish-game'}
          payload={finishPayload}
          onClose={onCloseOverlay}
        />
      )}
    </>
  );
}
