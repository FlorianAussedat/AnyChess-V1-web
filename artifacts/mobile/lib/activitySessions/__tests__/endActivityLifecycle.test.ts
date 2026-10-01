/**
 * Button → dialog → confirm/cancel → durable session mutation.
 * Covers recreation races (debounce, AppState, unmount, Home quit while the
 * previous screen stays mounted) and dialog host/queue behaviour.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import {
  __resetAppDialogStoreForTests,
  getAppDialogRequest,
  presentAppDialog,
  resolveAppDialog,
  subscribeAppDialog,
} from '../../ui/appDialogStore.ts';
import { confirmAction } from '../../openings/confirmAction.ts';
import {
  confirmAbandonGame,
  confirmQuitFromHome,
} from '../confirmDiscard.ts';
import { endActivity } from '../endActivity.ts';
import {
  __hydrateActivitySessionsFromStorageForTests,
  __setActivitySessionsStorageForTests,
  canPersistActivitySession,
  createActivitySessionId,
  getActivitySession,
  isActivitySessionEnded,
  listInProgressActivities,
  loadActivitySessions,
  upsertActivitySession,
  type ActivitySessionRecord,
} from '../index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

function sample(
  id: string,
  extras: Partial<ActivitySessionRecord> = {},
): ActivitySessionRecord {
  return {
    id,
    kind: 'classic',
    modeId: 'classic',
    noun: 'partie',
    title: 'Partie classique',
    summary: 'Blancs · adversaire <800',
    route: `/classic?sessionId=${id}`,
    updatedAt: 1,
    inProgress: true,
    payload: { history: ['e4'] },
    ...extras,
  };
}

class DelayStorage extends MemoryKeyValueStorage {
  delayMs = 0;
  async setItem(key: string, value: string): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    return super.setItem(key, value);
  }
}

class FailOnceStorage extends MemoryKeyValueStorage {
  failNext = false;
  async setItem(key: string, value: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('disk full');
    }
    return super.setItem(key, value);
  }
}

function attachHost(): { visible: () => ReturnType<typeof getAppDialogRequest> } {
  subscribeAppDialog(() => {
    /* host re-render */
  });
  return { visible: () => getAppDialogRequest() };
}

describe('end activity lifecycle', () => {
  beforeEach(() => {
    __setActivitySessionsStorageForTests(new MemoryKeyValueStorage());
    __resetAppDialogStoreForTests();
  });

  it('Quitter from Home goes button → request → host → confirm and drops only A', async () => {
    await upsertActivitySession(sample('A'));
    await upsertActivitySession(
      sample('B', { title: 'Partie B', summary: '1. d4', payload: { history: ['d4'] } }),
    );
    const host = attachHost();
    confirmQuitFromHome('classic', 'A');
    const request = host.visible();
    assert.ok(request);
    assert.equal(request?.confirmLabel, 'Quitter');
    assert.ok(request?.id);
    resolveAppDialog('cancel');
    assert.ok(getActivitySession('A'));
    assert.equal(listInProgressActivities().length, 2);

    confirmQuitFromHome('classic', 'A');
    resolveAppDialog('confirm');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(getActivitySession('A'), null);
    assert.ok(getActivitySession('B'));
    assert.equal(isActivitySessionEnded('A'), true);
    assert.equal(canPersistActivitySession('A'), false);
  });

  it('Abandonner confirm ends the game; Continuer keeps the exact session', async () => {
    await upsertActivitySession(sample('game-1'));
    let abandoned = false;
    confirmAbandonGame(() => {
      abandoned = true;
      void endActivity('game-1');
    });
    const queued = getAppDialogRequest();
    assert.equal(queued?.title, 'Abandonner cette partie ?');
    resolveAppDialog('cancel');
    assert.equal(abandoned, false);
    assert.equal(getActivitySession('game-1')?.payload && (getActivitySession('game-1')!.payload as { history: string[] }).history[0], 'e4');

    confirmAbandonGame(() => {
      abandoned = true;
      void endActivity('game-1');
    });
    resolveAppDialog('confirm');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(abandoned, true);
    assert.equal(getActivitySession('game-1'), null);
  });

  it('pending debounce, AppState flush and hook cleanup cannot recreate A', async () => {
    const storage = new MemoryKeyValueStorage();
    __setActivitySessionsStorageForTests(storage);
    await upsertActivitySession(sample('A'));
    let debounceFired = false;
    const debounce = new Promise<void>((resolve) => {
      setTimeout(() => {
        debounceFired = true;
        void upsertActivitySession(sample('A', { summary: 'late debounce' })).then(() => resolve());
      }, 250);
    });
    await endActivity('A');
    await upsertActivitySession(sample('A', { summary: 'AppState background' }));
    await upsertActivitySession(sample('A', { summary: 'unmount cleanup' }));
    await debounce;
    assert.equal(debounceFired, true);
    assert.equal(getActivitySession('A'), null);
    assert.equal(listInProgressActivities().length, 0);
    const disk = JSON.parse((await storage.getItem(StorageKeys.activitySessions.key)) ?? '{}');
    assert.equal(disk.sessions?.A, undefined);
  });

  it('Home Quitter while the previous screen stays mounted refuses later flushes', async () => {
    const storage = new MemoryKeyValueStorage();
    __setActivitySessionsStorageForTests(storage);
    await upsertActivitySession(sample('A'));
    confirmQuitFromHome('classic', 'A');
    resolveAppDialog('confirm');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await upsertActivitySession(sample('A', { summary: 'still mounted flush' }));
    await upsertActivitySession(sample('A', { summary: 'refocus' }));
    assert.equal(getActivitySession('A'), null);
    const disk = JSON.parse((await storage.getItem(StorageKeys.activitySessions.key)) ?? '{}');
    assert.equal(disk.sessions?.A, undefined);
    __setActivitySessionsStorageForTests(storage);
    const afterRestart = await loadActivitySessions();
    assert.equal(afterRestart.sessions.A, undefined);
  });

  it('concurrent save of B and delete of A keeps B and drops A on disk', async () => {
    const storage = new DelayStorage();
    storage.delayMs = 20;
    __setActivitySessionsStorageForTests(storage);
    await upsertActivitySession(sample('A'));
    storage.delayMs = 40;
    const saveB = upsertActivitySession(
      sample('B', { title: 'Partie B', payload: { history: ['d4'] } }),
    );
    const dropA = endActivity('A');
    await Promise.all([saveB, dropA]);
    assert.equal(getActivitySession('A'), null);
    assert.ok(getActivitySession('B'));
    const disk = JSON.parse((await storage.getItem(StorageKeys.activitySessions.key)) ?? '{}');
    assert.equal(disk.sessions?.A, undefined);
    assert.ok(disk.sessions?.B);
  });

  it('ends a persisted session before hydration and ignores empty / double confirm', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem(
      StorageKeys.activitySessions.key,
      JSON.stringify({
        version: 1,
        sessions: { ghost: sample('ghost') },
      }),
    );
    __setActivitySessionsStorageForTests(storage);
    assert.equal(getActivitySession('ghost'), null);
    await endActivity('ghost');
    assert.equal(getActivitySession('ghost'), null);
    await endActivity('ghost');
    await endActivity('');
    const disk = await __hydrateActivitySessionsFromStorageForTests();
    assert.equal(disk.sessions.ghost, undefined);
  });

  it('write failure does not throw, keep A ended, and a later B persist heals disk', async () => {
    const storage = new FailOnceStorage();
    __setActivitySessionsStorageForTests(storage);
    await upsertActivitySession(sample('A'));
    await upsertActivitySession(sample('B', { title: 'Partie B' }));
    storage.failNext = true;
    await endActivity('A');
    assert.equal(getActivitySession('A'), null);
    assert.ok(getActivitySession('B'));
    await upsertActivitySession(sample('B', { title: 'Partie B', summary: 'healed' }));
    __setActivitySessionsStorageForTests(storage);
    const restarted = await loadActivitySessions();
    assert.equal(restarted.sessions.A, undefined);
    assert.ok(restarted.sessions.B);
  });

  it('resume keeps the same id; a new game after abandon uses a fresh id', async () => {
    const first = await upsertActivitySession(sample('live'));
    const again = await upsertActivitySession(sample('live', { summary: '2. Nf3' }));
    assert.equal(first.id, again.id);
    assert.equal(listInProgressActivities().length, 1);
    await endActivity('live');
    const nextId = createActivitySessionId();
    assert.notEqual(nextId, 'live');
    await upsertActivitySession(sample(nextId));
    assert.equal(getActivitySession('live'), null);
    assert.ok(getActivitySession(nextId));
    assert.equal(listInProgressActivities().length, 1);
  });

  it('Cancel and Home suspend keep the session; ending analysis keeps the library key', async () => {
    const storage = new MemoryKeyValueStorage();
    const libraryBlob = JSON.stringify({ version: 1, games: [{ id: 'pgn-1' }] });
    await storage.setItem(StorageKeys.gameLibrary.key, libraryBlob);
    __setActivitySessionsStorageForTests(storage);
    await upsertActivitySession(
      sample('ana', {
        kind: 'parties-analyzer',
        modeId: 'parties',
        noun: 'partie',
        title: 'Analyse de partie',
        summary: 'Italian game',
        route: '/parties/analyzer?sessionId=ana',
      }),
    );
    confirmQuitFromHome('parties-analyzer', 'ana');
    resolveAppDialog('cancel');
    assert.ok(getActivitySession('ana'));
    await upsertActivitySession(
      sample('ana', {
        kind: 'parties-analyzer',
        modeId: 'parties',
        title: 'Analyse de partie',
        summary: 'suspended from Home tab',
      }),
    );
    assert.ok(getActivitySession('ana'));
    await endActivity('ana');
    assert.equal(getActivitySession('ana'), null);
    assert.equal(await storage.getItem(StorageKeys.gameLibrary.key), libraryBlob);
  });
});

describe('app dialog host and queue', () => {
  beforeEach(() => {
    __resetAppDialogStoreForTests();
  });

  it('snapshot stays readable after present, before subscribe, and after remount', () => {
    presentAppDialog({
      title: 'Quitter la partie ?',
      message: '',
      cancelLabel: 'Annuler',
      confirmLabel: 'Quitter',
      variant: 'confirm',
    });
    const beforeSubscribe = getAppDialogRequest();
    assert.equal(beforeSubscribe?.title, 'Quitter la partie ?');
    let ticks = 0;
    const unsub = subscribeAppDialog(() => {
      ticks += 1;
    });
    assert.equal(getAppDialogRequest()?.id, beforeSubscribe?.id);
    unsub();
    const remountTicks: number[] = [];
    subscribeAppDialog(() => {
      remountTicks.push(getAppDialogRequest()?.id ?? -1);
    });
    assert.equal(getAppDialogRequest()?.title, 'Quitter la partie ?');
    assert.equal(ticks, 0);
    assert.deepEqual(remountTicks, []);
  });

  it('resolves exactly once and queues a concurrent present', () => {
    let first = 0;
    let second = 0;
    presentAppDialog({
      title: 'First',
      message: '',
      variant: 'confirm',
      confirmLabel: 'OK',
      onConfirm: () => {
        first += 1;
      },
    });
    presentAppDialog({
      title: 'Second',
      message: '',
      variant: 'destructive',
      confirmLabel: 'OK',
      onConfirm: () => {
        second += 1;
      },
    });
    assert.equal(getAppDialogRequest()?.title, 'First');
    resolveAppDialog('confirm');
    assert.equal(first, 1);
    assert.equal(getAppDialogRequest()?.title, 'Second');
    resolveAppDialog('confirm');
    resolveAppDialog('confirm');
    assert.equal(second, 1);
    assert.equal(getAppDialogRequest(), null);
  });

  it('Android back cancels the open dialog and does not confirm deletion', async () => {
    __setActivitySessionsStorageForTests(new MemoryKeyValueStorage());
    await upsertActivitySession(sample('keep'));
    let confirmed = 0;
    confirmAction('Quitter la partie ?', '', () => {
      confirmed += 1;
      void endActivity('keep');
    });
    resolveAppDialog('cancel');
    assert.equal(confirmed, 0);
    assert.ok(getActivitySession('keep'));
  });

  it('host and persist hook use the durable guards', () => {
    const host = read('components/ui/AppDialogHost.tsx');
    const hook = read('hooks/usePersistedActivity.ts');
    const store = read('lib/activitySessions/ActivitySessionsStore.ts');
    const end = read('lib/activitySessions/endActivity.ts');
    assert.match(host, /useSyncExternalStore/);
    assert.match(host, /getAppDialogRequest/);
    assert.match(hook, /canPersistActivitySession/);
    assert.match(hook, /isActivitySessionEnded/);
    assert.match(hook, /createActivitySessionId\(\)/);
    assert.match(store, /endedIds/);
    assert.match(store, /enqueueWrite/);
    assert.match(end, /markActivitySessionEnded/);
  });
});
