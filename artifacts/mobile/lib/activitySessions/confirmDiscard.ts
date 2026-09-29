import { confirmAction } from '../openings/confirmAction.ts';
import { tMsg } from '../i18n/tMsg.ts';
import { endActivity } from './endActivity.ts';
import {
  activeSessionBackCopy,
  handleActiveSessionBackConfirm,
  type ActiveSessionBackKind,
} from './sessionBack.ts';
import {
  endCopyForKind,
  type ActivityEndCopy,
  type ActivityKind,
  type ActivityNoun,
} from './types.ts';

const TITLE: Record<
  ActivityNoun,
  | 'activity.discardPartieTitle'
  | 'activity.discardProblemeTitle'
  | 'activity.discardQuizTitle'
  | 'activity.discardCoursTitle'
  | 'activity.discardExerciceTitle'
> = {
  partie: 'activity.discardPartieTitle',
  probleme: 'activity.discardProblemeTitle',
  quiz: 'activity.discardQuizTitle',
  cours: 'activity.discardCoursTitle',
  exercice: 'activity.discardExerciceTitle',
};

const BODY: Record<
  ActivityNoun,
  | 'activity.discardPartieBody'
  | 'activity.discardProblemeBody'
  | 'activity.discardQuizBody'
  | 'activity.discardCoursBody'
  | 'activity.discardExerciceBody'
> = {
  partie: 'activity.discardPartieBody',
  probleme: 'activity.discardProblemeBody',
  quiz: 'activity.discardQuizBody',
  cours: 'activity.discardCoursBody',
  exercice: 'activity.discardExerciceBody',
};

const CONFIRM: Record<
  ActivityNoun,
  | 'activity.discardPartieConfirm'
  | 'activity.discardProblemeConfirm'
  | 'activity.discardQuizConfirm'
  | 'activity.discardCoursConfirm'
  | 'activity.discardExerciceConfirm'
> = {
  partie: 'activity.discardPartieConfirm',
  probleme: 'activity.discardProblemeConfirm',
  quiz: 'activity.discardQuizConfirm',
  cours: 'activity.discardCoursConfirm',
  exercice: 'activity.discardExerciceConfirm',
};

/**
 * Confirmation shown only when the user is about to destroy an activity.
 * Cancel keeps the session and stays on the current screen.
 */
export function confirmDiscardActivity(
  noun: ActivityNoun,
  onConfirm: () => void,
): void {
  confirmAction(tMsg(TITLE[noun]), tMsg(BODY[noun]), onConfirm, {
    cancelLabel: tMsg('common.cancel'),
    confirmLabel: tMsg(CONFIRM[noun]),
    destructive: true,
  });
}

type HomeCopy = {
  title:
    | 'activity.endPartieTitle'
    | 'activity.endExerciceTitle'
    | 'activity.endAnalyseTitle'
    | 'activity.endQuizTitle'
    | 'activity.endTrainingTitle';
  body:
    | 'activity.endPartieBody'
    | 'activity.endExerciceBody'
    | 'activity.endAnalyseBody'
    | 'activity.endQuizBody'
    | 'activity.endTrainingBody';
};

const HOME: Record<ActivityEndCopy, HomeCopy> = {
  partie: { title: 'activity.endPartieTitle', body: 'activity.endPartieBody' },
  exercice: { title: 'activity.endExerciceTitle', body: 'activity.endExerciceBody' },
  analyse: { title: 'activity.endAnalyseTitle', body: 'activity.endAnalyseBody' },
  quiz: { title: 'activity.endQuizTitle', body: 'activity.endQuizBody' },
  entrainement: { title: 'activity.endTrainingTitle', body: 'activity.endTrainingBody' },
};

const LEAVE_CONTINUE: Record<
  ActivityEndCopy,
  'activity.continueGame' | 'activity.continueExercise' | 'activity.continueTraining'
> = {
  partie: 'activity.continueGame',
  analyse: 'activity.continueGame',
  quiz: 'activity.continueExercise',
  exercice: 'activity.continueExercise',
  entrainement: 'activity.continueTraining',
};

/** Home list: Annuler / Quitter. Ends only this activity on confirm. */
export function confirmQuitFromHome(
  kind: ActivityKind,
  activityId: string,
  onEnded?: () => void,
): void {
  const copy = HOME[endCopyForKind(kind)];
  confirmAction(tMsg(copy.title), tMsg(copy.body), () => {
    void endActivity(activityId).then(() => onEnded?.());
  }, {
    cancelLabel: tMsg('common.cancel'),
    confirmLabel: tMsg('activity.quitCta'),
    destructive: true,
  });
}

/**
 * Header back from an exercise toward its selection hub.
 * Cancel stays in the exercise; confirm ends that session then runs onLeave.
 */
export function confirmLeaveToHub(
  kind: ActivityKind,
  activityId: string,
  onLeave: () => void,
): void {
  const copy = HOME[endCopyForKind(kind)];
  const continueKey = LEAVE_CONTINUE[endCopyForKind(kind)];
  confirmAction(tMsg(copy.title), tMsg(copy.body), () => {
    void endActivity(activityId).then(() => onLeave());
  }, {
    cancelLabel: tMsg(continueKey),
    confirmLabel: tMsg('activity.quitCta'),
    destructive: true,
  });
}

/** In-game abandon of a chess game. Does not start a replacement game. */
export function confirmAbandonGame(onConfirm: () => void): void {
  confirmAction(tMsg('activity.abandonTitle'), tMsg('activity.abandonBody'), onConfirm, {
    cancelLabel: tMsg('activity.continueGame'),
    confirmLabel: tMsg('activity.abandonConfirm'),
    destructive: true,
  });
}

export type { ActiveSessionBackKind } from './sessionBack.ts';

/**
 * Header / Android back while a live game or exercise is on screen.
 * Cancel stays put. Confirm ends that persisted session then runs onLeave.
 */
export function confirmActiveSessionBack(
  kind: ActiveSessionBackKind,
  activityId: string | undefined,
  onLeave: () => void,
): void {
  const copy = activeSessionBackCopy(kind);
  confirmAction(copy.title, '', () => {
    void handleActiveSessionBackConfirm(activityId, onLeave);
  }, {
    cancelLabel: copy.cancelLabel,
    confirmLabel: copy.confirmLabel,
    destructive: true,
  });
}
