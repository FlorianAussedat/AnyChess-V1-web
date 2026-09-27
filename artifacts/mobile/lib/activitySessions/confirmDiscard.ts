import { confirmAction } from '../openings/confirmAction.ts';
import { tMsg } from '../i18n/tMsg.ts';
import type { ActivityNoun } from './types.ts';

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

const CONFIRM: Record<ActivityNoun, 'activity.discardPartieConfirm' | 'activity.discardProblemeConfirm' | 'activity.discardQuizConfirm' | 'activity.discardCoursConfirm' | 'activity.discardExerciceConfirm'> =
  {
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
