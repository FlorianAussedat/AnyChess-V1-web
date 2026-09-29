/**
 * Header + Android back confirmation while a game or exercise is active.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { translate } from '../../i18n/messages.ts';
import {
  __setActivitySessionsStorageForTests,
  getActivitySession,
  listInProgressActivities,
  upsertActivitySession,
} from '../ActivitySessionsStore.ts';
import {
  activeSessionBackCopy,
  handleActiveSessionBackConfirm,
} from '../sessionBack.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

const samplePartie = {
  id: 'game-1',
  kind: 'classic' as const,
  modeId: 'classic' as const,
  noun: 'partie' as const,
  title: 'Partie classique',
  summary: 'e4',
  route: '/classic?sessionId=game-1',
  updatedAt: 1,
  inProgress: true,
  payload: { history: ['e4'] },
};

const sampleExercice = {
  id: 'ex-1',
  kind: 'puzzles-tactical' as const,
  modeId: 'puzzles' as const,
  noun: 'probleme' as const,
  title: 'Tactiques',
  summary: 'abc',
  route: '/puzzles?sessionId=ex-1',
  updatedAt: 1,
  inProgress: true,
  payload: {},
};

describe('active session back copy', () => {
  it('partie uses Quitter la partie ? / Annuler / Quitter', () => {
    const copy = activeSessionBackCopy('partie');
    assert.equal(copy.title, translate('fr', 'activity.backPartieTitle'));
    assert.equal(copy.title, 'Quitter la partie ?');
    assert.equal(copy.cancelLabel, translate('fr', 'common.cancel'));
    assert.equal(copy.cancelLabel, 'Annuler');
    assert.equal(copy.confirmLabel, translate('fr', 'activity.quitCta'));
    assert.equal(copy.confirmLabel, 'Quitter');
  });

  it('exercice uses Abandonner l’exercice ? / Annuler / Abandonner', () => {
    const copy = activeSessionBackCopy('exercice');
    assert.equal(copy.title, translate('fr', 'activity.backExerciceTitle'));
    assert.equal(copy.title, 'Abandonner l’exercice ?');
    assert.equal(copy.cancelLabel, 'Annuler');
    assert.equal(copy.confirmLabel, translate('fr', 'activity.backExerciceConfirm'));
    assert.equal(copy.confirmLabel, 'Abandonner');
  });
});

describe('confirming back actually abandons the session', () => {
  beforeEach(() => {
    __setActivitySessionsStorageForTests(new MemoryKeyValueStorage());
  });

  it('Quitter ends the game session then navigates', async () => {
    await upsertActivitySession(samplePartie);
    let left = false;
    await handleActiveSessionBackConfirm('game-1', () => {
      left = true;
    });
    assert.equal(left, true);
    assert.equal(getActivitySession('game-1'), null);
    assert.equal(listInProgressActivities().length, 0);
  });

  it('Abandonner ends the exercise session then navigates', async () => {
    await upsertActivitySession(sampleExercice);
    let left = false;
    await handleActiveSessionBackConfirm('ex-1', () => {
      left = true;
    });
    assert.equal(left, true);
    assert.equal(getActivitySession('ex-1'), null);
  });

  it('Annuler is a no-op — session stays in progress until confirm runs', async () => {
    await upsertActivitySession(samplePartie);
    assert.equal(getActivitySession('game-1')?.inProgress, true);
    assert.equal(listInProgressActivities().length, 1);
  });
});

describe('header and Android back share one guard', () => {
  it('useActiveSessionBack intercepts hardwareBackPress like the header', () => {
    const hook = read('hooks/useActiveSessionBack.ts');
    assert.match(hook, /BackHandler\.addEventListener\('hardwareBackPress'/);
    assert.match(hook, /if \(!current\.sessionActive && !current\.captureHardwareBack\) return false/);
    assert.match(hook, /confirmActiveSessionBack\(current\.kind, current\.activityId, current\.onLeave\)/);
    const confirm = read('lib/activitySessions/confirmDiscard.ts');
    assert.match(confirm, /function confirmActiveSessionBack/);
    assert.match(confirm, /handleActiveSessionBackConfirm\(activityId, onLeave\)/);
    assert.match(confirm, /activeSessionBackCopy\(kind\)/);
    assert.match(hook, /useFocusEffect/);
    assert.match(hook, /current\.onNavigateBack\(\)/);
  });

  it('classic game back confirms only while the game is active', () => {
    const classic = read('components/ClassicGameScreen.tsx');
    assert.match(classic, /useActiveSessionBack/);
    assert.match(classic, /sessionActive: campLocked && !isGameOver/);
    assert.match(classic, /kind: 'partie'/);
    assert.match(classic, /onBack=\{onBack\}/);
    assert.match(classic, /confirmAbandonGame/);
    assert.match(classic, /abandonActive=\{campLocked\}/);
    assert.match(classic, /captureHardwareBack: true/);
  });

  it('opening training header uses exercise copy; action row keep existing quit', () => {
    const opening = read('components/OpeningGameScreen.tsx');
    assert.match(opening, /useActiveSessionBack/);
    assert.match(opening, /sessionActive: ready && history\.length > 0 && !isGameOver/);
    assert.match(opening, /kind: 'exercice'/);
    assert.match(opening, /confirmLeaveToHub\('opening-play'/);
  });

  it('exercise screens wire the shared back guard', () => {
    const files = [
      'contexts/PuzzleContext.tsx',
      'contexts/BlindSequenceContext.tsx',
      'app/puzzles/finales-theoriques-play.tsx',
      'app/puzzles/defends-nulle-play.tsx',
      'app/visualisation/nommer.tsx',
      'app/visualisation/jouer.tsx',
      'app/visualisation/mental.tsx',
      'app/quiz-ouverture/quelle.tsx',
      'app/quiz-ouverture/culture.tsx',
      'app/openings/continue.tsx',
    ];
    for (const rel of files) {
      const src = read(rel);
      assert.match(src, /useActiveSessionBack/, rel);
      assert.match(src, /kind: 'exercice'/, rel);
    }
  });

  it('finished or idle screens skip the popup via sessionActive', () => {
    const classic = read('components/ClassicGameScreen.tsx');
    assert.match(classic, /campLocked && !isGameOver/);
    const puzzle = read('contexts/PuzzleContext.tsx');
    assert.match(puzzle, /phase === 'playing' \|\| phase === 'solution-replay'/);
    const finales = read('app/puzzles/finales-theoriques-play.tsx');
    assert.match(finales, /snap\.phase === 'playing'/);
    const culture = read('app/quiz-ouverture/culture.tsx');
    assert.match(culture, /sessionActive: phase === 'playing'/);
    const continueLine = read('app/openings/continue.tsx');
    assert.match(continueLine, /snap\.phase === 'reciting'/);
  });

  it('other screens keep immediate back without the session guard', () => {
    const home = read('app/index.tsx');
    const records = read('app/records.tsx');
    const settings = read('app/parametres.tsx');
    const analyzer = read('app/parties/analyzer.tsx');
    const openingsIndex = read('app/openings/index.tsx');
    assert.doesNotMatch(home, /useActiveSessionBack/);
    assert.doesNotMatch(records, /useActiveSessionBack/);
    assert.doesNotMatch(settings, /useActiveSessionBack/);
    assert.doesNotMatch(analyzer, /useActiveSessionBack/);
    assert.doesNotMatch(openingsIndex, /useActiveSessionBack/);
    assert.match(records, /onBack=\{\(\) => router\.back\(\)\}/);
    assert.match(settings, /onBack=\{\(\) => router\.back\(\)\}/);
  });
});
