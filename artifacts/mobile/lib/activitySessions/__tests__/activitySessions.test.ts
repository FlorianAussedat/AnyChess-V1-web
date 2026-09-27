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
  createActivitySessionId,
  getActivitySession,
  listInProgressActivities,
  loadActivitySessions,
  markActivityFinished,
  nounForKind,
  removeActivitySession,
  upsertActivitySession,
} from '../index.ts';

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
});

describe('activity leave paths keep mid-session state', () => {
  it('vision screens persist instead of wiping on ordinary back', () => {
    const nommer = readFileSync(join(mobileRoot, 'app/visualisation/nommer.tsx'), 'utf8');
    const jouer = readFileSync(join(mobileRoot, 'app/visualisation/jouer.tsx'), 'utf8');
    const mental = readFileSync(join(mobileRoot, 'app/visualisation/mental.tsx'), 'utf8');
    assert.match(nommer, /usePersistedActivity/);
    assert.match(jouer, /usePersistedActivity/);
    assert.match(mental, /usePersistedActivity/);
    assert.match(nommer, /pauseTimers/);
    assert.match(jouer, /pauseTimers/);
    assert.match(nommer, /router\.navigate\('\/'\)/);
    assert.match(jouer, /router\.navigate\('\/'\)/);
    assert.match(mental, /router\.navigate\('\/'\)/);
  });

  it('ModeCard descriptions stay untruncated', () => {
    const card = readFileSync(join(mobileRoot, 'components/home/ModeCard.tsx'), 'utf8');
    assert.doesNotMatch(card, /numberOfLines/);
  });
});
