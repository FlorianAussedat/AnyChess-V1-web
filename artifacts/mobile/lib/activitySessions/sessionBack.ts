import { tMsg } from '../i18n/tMsg.ts';
import { endActivity } from './endActivity.ts';

export type ActiveSessionBackKind = 'partie' | 'exercice';

export function activeSessionBackCopy(kind: ActiveSessionBackKind): {
  title: string;
  cancelLabel: string;
  confirmLabel: string;
} {
  if (kind === 'partie') {
    return {
      title: tMsg('activity.backPartieTitle'),
      cancelLabel: tMsg('common.cancel'),
      confirmLabel: tMsg('activity.quitCta'),
    };
  }
  return {
    title: tMsg('activity.backExerciceTitle'),
    cancelLabel: tMsg('common.cancel'),
    confirmLabel: tMsg('activity.backExerciceConfirm'),
  };
}

/** Shared confirm callback: discard the persisted session then leave. */
export function handleActiveSessionBackConfirm(
  activityId: string | undefined,
  onLeave: () => void,
): Promise<void> {
  if (activityId) {
    return endActivity(activityId).then(() => {
      onLeave();
    });
  }
  onLeave();
  return Promise.resolve();
}
