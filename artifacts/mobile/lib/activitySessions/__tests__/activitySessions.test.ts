import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { chessFromSanHistory } from '../chessHistory.ts';
import {
  __setActivitySessionsStorageForTests,
  getActivitySession,
  listInProgressActivities,
  loadActivitySessions,
  markActivityFinished,
  removeActivitySession,
  upsertActivitySession,
} from '../ActivitySessionsStore.ts';
import { endActivity } from '../endActivity.ts';
import { createActivitySessionId, endCopyForKind, nounForKind } from '../types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

describe('activity session store', () => {
  beforeEach(() => {
    __setActivitySessionsStorageForTests(new MemoryKeyValueStorage());
  });

  it('registers a dedicated storage key', () => {
    assert.equal(StorageKeys.activitySessions.key, 'anychess.activitySessions.v1');
  });

  it('keeps two activities of the same kind instead of overwriting', async () => {
    const a = await upsertActivitySession({
      id: createActivitySessionId(),
      kind: 'classic',
      modeId: 'classic',
      noun: 'partie',
      title: 'Partie A',
      summary: '1. e4',
      route: '/classic?sessionId=a',
      updatedAt: 1,
      inProgress: true,
      payload: { history: ['e4'] },
    });
    const b = await upsertActivitySession({
      id: createActivitySessionId(),
      kind: 'classic',
      modeId: 'classic',
      noun: 'partie',
      title: 'Partie B',
      summary: '1. d4',
      route: '/classic?sessionId=b',
      updatedAt: 2,
      inProgress: true,
      payload: { history: ['d4'] },
    });
    assert.notEqual(a.id, b.id);
    const listed = listInProgressActivities();
    assert.equal(listed.length, 2);
    assert.ok(getActivitySession(a.id));
    assert.ok(getActivitySession(b.id));
  });

  it('removes only the discarded session', async () => {
    const first = await upsertActivitySession({
      id: 'keep',
      kind: 'culture',
      modeId: 'quiz-ouverture',
      noun: 'quiz',
      title: 'Culture',
      summary: '3/10',
      route: '/quiz-ouverture/culture?sessionId=keep',
      updatedAt: 1,
      inProgress: true,
      payload: {},
    });
    await upsertActivitySession({
      id: 'drop',
      kind: 'quelle',
      modeId: 'quiz-ouverture',
      noun: 'quiz',
      title: 'Quelle',
      summary: '1/10',
      route: '/quiz-ouverture/quelle?sessionId=drop',
      updatedAt: 2,
      inProgress: true,
      payload: {},
    });
    await removeActivitySession('drop');
    assert.equal(getActivitySession(first.id)?.id, 'keep');
    assert.equal(getActivitySession('drop'), null);
    assert.equal(listInProgressActivities().length, 1);
  });

  it('maps kinds to the discard noun', () => {
    assert.equal(nounForKind('classic'), 'partie');
    assert.equal(nounForKind('puzzles-tactical'), 'probleme');
    assert.equal(nounForKind('culture'), 'quiz');
    assert.equal(nounForKind('opening-study'), 'cours');
    assert.equal(nounForKind('blind'), 'exercice');
  });

  it('replays a SAN history onto a chess.js board', () => {
    const game = chessFromSanHistory(['e4', 'e5', 'Nf3']);
    assert.ok(game);
    assert.deepEqual(game.history(), ['e4', 'e5', 'Nf3']);
  });

  it('hydrates from storage', async () => {
    await upsertActivitySession({
      id: 'disk',
      kind: 'classic',
      modeId: 'classic',
      noun: 'partie',
      title: 'Partie',
      summary: '',
      route: '/classic?sessionId=disk',
      updatedAt: 1,
      inProgress: true,
      payload: { history: ['e4'] },
    });
    const storage = new MemoryKeyValueStorage();
    const raw = JSON.stringify({
      version: 1,
      sessions: {
        disk: {
          id: 'disk',
          kind: 'classic',
          modeId: 'classic',
          noun: 'partie',
          title: 'Partie',
          summary: '',
          route: '/classic?sessionId=disk',
          updatedAt: 9,
          inProgress: true,
          payload: { history: ['e4'] },
        },
      },
    });
    await storage.setItem(StorageKeys.activitySessions.key, raw);
    __setActivitySessionsStorageForTests(storage);
    const doc = await loadActivitySessions();
    assert.equal(doc.sessions.disk?.payload && (doc.sessions.disk.payload as { history: string[] }).history[0], 'e4');
  });

  it('marks a session finished without deleting it', async () => {
    await upsertActivitySession({
      id: 'live',
      kind: 'nommer',
      modeId: 'visualisation',
      noun: 'exercice',
      title: 'Nommer',
      summary: '3',
      route: '/visualisation/nommer?sessionId=live',
      updatedAt: 1,
      inProgress: true,
      payload: {},
    });
    await markActivityFinished('live');
    assert.equal(getActivitySession('live')?.inProgress, false);
    assert.equal(listInProgressActivities().length, 0);
  });

  it('endActivity removes only the targeted session', async () => {
    await upsertActivitySession({
      id: 'keep-me',
      kind: 'classic',
      modeId: 'classic',
      noun: 'partie',
      title: 'Partie classique',
      summary: 'Blancs · adversaire <800',
      route: '/classic?sessionId=keep-me',
      updatedAt: 1,
      inProgress: true,
      payload: { history: ['e4'] },
    });
    await upsertActivitySession({
      id: 'drop-me',
      kind: 'puzzles-tactical',
      modeId: 'puzzles',
      noun: 'probleme',
      title: 'Entraînement tactique',
      summary: 'abc · 1400',
      route: '/puzzles?sessionId=drop-me',
      updatedAt: 2,
      inProgress: true,
      payload: {},
    });
    await endActivity('drop-me');
    assert.equal(getActivitySession('drop-me'), null);
    assert.ok(getActivitySession('keep-me'));
    assert.equal(listInProgressActivities().length, 1);
    assert.equal(listInProgressActivities()[0]?.id, 'keep-me');
  });

  it('endActivity is a no-op for an unknown id', async () => {
    await endActivity('missing');
    assert.equal(listInProgressActivities().length, 0);
  });

  it('maps kinds onto user-facing quit copy', () => {
    assert.equal(endCopyForKind('classic'), 'partie');
    assert.equal(endCopyForKind('parties-analyzer'), 'analyse');
    assert.equal(endCopyForKind('culture'), 'quiz');
    assert.equal(endCopyForKind('opening-play'), 'entrainement');
    assert.equal(endCopyForKind('puzzles-tactical'), 'exercice');
  });
});

describe('activity leave paths keep mid-session state', () => {
  it('vision screens persist instead of wiping on ordinary back', () => {
    const nommer = readFileSync(join(mobileRoot, 'app/visualisation/nommer.tsx'), 'utf8');
    const jouer = readFileSync(join(mobileRoot, 'app/visualisation/jouer.tsx'), 'utf8');
    const mental = readFileSync(join(mobileRoot, 'app/visualisation/mental.tsx'), 'utf8');
    assert.match(nommer, /usePersistedActivity/);
    assert.match(jouer, /usePersistedActivity/);
    assert.match(mental, /usePersistedActivity/);
    assert.match(nommer, /useActiveSessionBack/);
    assert.match(jouer, /useActiveSessionBack/);
    assert.match(mental, /useActiveSessionBack/);
    assert.match(nommer, /router\.navigate\('\/'\)/);
    assert.match(jouer, /router\.navigate\('\/'\)/);
    assert.match(mental, /router\.navigate\('\/'\)/);
  });

  it('ModeCard descriptions stay untruncated', () => {
    const card = readFileSync(join(mobileRoot, 'components/home/ModeCard.tsx'), 'utf8');
    assert.doesNotMatch(card, /numberOfLines/);
  });

  it('home resume rows expose Quitter and Reprendre per activity', () => {
    const src = readFileSync(join(mobileRoot, 'components/home/ResumeActivities.tsx'), 'utf8');
    assert.match(src, /confirmQuitFromHome\(item\.kind, item\.id\)/);
    assert.match(src, /resume-activity-quit-\$\{item\.id\}/);
    assert.match(src, /resume-activity-resume-\$\{item\.id\}/);
    assert.match(src, /activity\.quitCta/);
    assert.match(src, /activity\.resumeCta/);
  });

  it('live Partie/Exercice → Analyse does not persist a second activity', () => {
    const analyzer = readFileSync(join(mobileRoot, 'app/parties/analyzer.tsx'), 'utf8');
    assert.match(analyzer, /fromLiveWorkflow/);
    assert.match(analyzer, /enabled: !!game && !showPaste && !fromLiveWorkflow/);
    assert.doesNotMatch(analyzer, /useActiveSessionBack/);
    const classic = readFileSync(join(mobileRoot, 'components/ClassicGameScreen.tsx'), 'utf8');
    const opening = readFileSync(join(mobileRoot, 'components/OpeningGameScreen.tsx'), 'utf8');
    assert.match(classic, /source: 'live'/);
    assert.match(opening, /source: 'live'/);
  });

  it('classic abandon ends the session and returns to camp setup', () => {
    const classic = readFileSync(join(mobileRoot, 'components/ClassicGameScreen.tsx'), 'utf8');
    assert.match(classic, /confirmAbandonGame/);
    assert.match(classic, /endActivity\(sessionId\)/);
    assert.match(classic, /returnToCampSetup/);
    assert.match(classic, /abandonActive=\{campLocked\}/);
    assert.doesNotMatch(
      classic,
      /confirmAbandonGame\(\(\) => \{[\s\S]*newGame\(\)/,
    );
  });

  it('exercise back toward the hub confirms then ends only that session', () => {
    const puzzle = readFileSync(join(mobileRoot, 'contexts/PuzzleContext.tsx'), 'utf8');
    const blind = readFileSync(join(mobileRoot, 'contexts/BlindSequenceContext.tsx'), 'utf8');
    const finales = readFileSync(
      join(mobileRoot, 'app/puzzles/finales-theoriques-play.tsx'),
      'utf8',
    );
    const nulle = readFileSync(join(mobileRoot, 'app/puzzles/defends-nulle-play.tsx'), 'utf8');
    assert.match(puzzle, /useActiveSessionBack/);
    assert.doesNotMatch(puzzle, /captureHardwareBack/);
    assert.match(blind, /useActiveSessionBack/);
    assert.doesNotMatch(blind, /captureHardwareBack/);
    assert.match(puzzle, /sessionActive: phase === 'playing' \|\| phase === 'solution-replay'/);
    assert.match(blind, /useActiveSessionBack/);
    assert.match(finales, /useActiveSessionBack/);
    assert.match(nulle, /useActiveSessionBack/);
    assert.doesNotMatch(puzzle, /router\.navigate\('\/'\)/);
  });
});
