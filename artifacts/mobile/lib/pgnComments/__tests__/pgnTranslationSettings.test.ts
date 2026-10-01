import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import {
  PreferencesStore,
  defaultUserPreferences,
} from '../../preferences/PreferencesStore.ts';
import {
  FakePgnTranslationProvider,
  PgnCommentTranslationStore,
  PgnTranslationQueue,
  applyFrenchToPgnText,
  applyPgnTranslationPreferences,
  collectPgnCommentUnits,
  describePgnFileTranslation,
  enqueueExistingPgns,
  hasUsableFrenchTranslation,
  isEchoTranslation,
  policyFromPreferences,
  resolvePgnComment,
  scheduleImportedPgnComments,
  shouldTranslateOnImport,
} from '../index.ts';

const PGN_OPENING = `[Event "Openings"]

1. e4 {White occupies the center.} e5 {[%eval 0.12] Black answers in kind.} *`;

const PGN_PARTY = `[Event "Parties"]

1. e4 e5 2. Nf3 (2. Nc3 {White develops the knight.}) *`;

function englishPgn(count: number, fileTag = 'Batch'): string {
  const chunks = [`[Event "${fileTag}"]\n\n`];
  for (let i = 0; i < count; i += 1) {
    const ply = i % 2 === 0 ? `${Math.floor(i / 2) + 1}. e4` : 'e5';
    chunks.push(`${ply} {White occupies the center number ${i}.} `);
  }
  chunks.push('*');
  return chunks.join('');
}

function fakeMapFor(pgn: string, source: 'repertoire' | 'gameLibrary', fileId: string) {
  const map: Record<string, string> = {};
  for (const unit of collectPgnCommentUnits(pgn, source, fileId)) {
    map[unit.original] = `FR ${unit.original}`;
  }
  return map;
}

describe('PGN translation settings policy', () => {
  it('defaults both options off and does not schedule import', () => {
    const prefs = defaultUserPreferences();
    assert.equal(prefs.translateExistingPgnComments, false);
    assert.equal(prefs.translateImportedPgnComments, false);
    assert.equal(shouldTranslateOnImport(prefs), false);
    assert.deepEqual(policyFromPreferences(prefs), { catchup: false, import: false });
  });

  it('1. persists the two options after a store remount', async () => {
    const storage = new MemoryKeyValueStorage();
    const prefs = new PreferencesStore(storage);
    await prefs.update({
      translateExistingPgnComments: true,
      translateImportedPgnComments: false,
    });
    const remount = new PreferencesStore(storage);
    await remount.ensureLoaded();
    assert.equal(remount.getPreferences().translateExistingPgnComments, true);
    assert.equal(remount.getPreferences().translateImportedPgnComments, false);
  });

  it('2. enabling catch-up enqueues Openings and Parties including variations', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    const prefs = new PreferencesStore(kv);
    await prefs.update({ translateExistingPgnComments: true });
    await applyPgnTranslationPreferences({
      queue,
      preferences: prefs,
      start: false,
      collectFiles: async () => [
        { source: 'repertoire', fileId: 'open-1', pgnText: PGN_OPENING },
        { source: 'gameLibrary', fileId: 'party-1', pgnText: PGN_PARTY },
      ],
    });
    const jobs = Object.values(queue.getSnapshot().jobs);
    assert.equal(jobs.length, 3);
    assert.ok(jobs.every((job) => job.origin === 'catchup'));
    assert.ok(jobs.some((job) => job.original.includes('develops the knight')));
  });

  it('3. import option on enqueues, off does not', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    const prefs = new PreferencesStore(kv);
    const off = await scheduleImportedPgnComments(PGN_PARTY, 'gameLibrary', 'imp-off', {
      queue,
      preferences: prefs,
    });
    assert.equal(off, 0);
    assert.equal(Object.keys(queue.getSnapshot().jobs).length, 0);

    await prefs.update({ translateImportedPgnComments: true });
    queue.setProvider(new FakePgnTranslationProvider(fakeMapFor(PGN_PARTY, 'gameLibrary', 'imp-on')));
    const on = await scheduleImportedPgnComments(PGN_PARTY, 'gameLibrary', 'imp-on', {
      queue,
      preferences: prefs,
    });
    assert.equal(on, 1);
    const job = Object.values(queue.getSnapshot().jobs)[0];
    assert.equal(job?.origin, 'import');
  });

  it('4. successive catch-up activations do not duplicate jobs', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    const files = [{ source: 'repertoire' as const, fileId: 'open-1', pgnText: PGN_OPENING }];
    const first = await enqueueExistingPgns(files, { origin: 'catchup' }, queue);
    const second = await enqueueExistingPgns(files, { origin: 'catchup' }, queue);
    assert.equal(first, 2);
    assert.equal(second, 0);
    assert.equal(Object.keys(queue.getSnapshot().jobs).length, 2);
  });

  it('5. pause keeps completed translations and resume only finishes the rest', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store, { timeoutMs: 200 });
    const pgn = englishPgn(3, 'Pause');
    queue.setProvider(new FakePgnTranslationProvider(fakeMapFor(pgn, 'repertoire', 'p1')));
    await queue.enqueuePgn(pgn, 'repertoire', 'p1', 'catchup');
    const first = await queue.processNext(1);
    assert.equal(first.done, 1);
    await queue.pauseOrigins(['catchup']);
    assert.ok(Object.values(queue.getSnapshot().jobs).some((j) => j.status === 'paused'));
    assert.equal(
      Object.values(store.getSnapshot().records).filter((r) => r.status === 'ready').length,
      1,
    );
    await queue.resumeOrigins(['catchup']);
    const rest = await queue.processUntilIdle();
    assert.equal(rest.done, 2);
    assert.equal(
      Object.values(store.getSnapshot().records).filter((r) => r.status === 'ready').length,
      3,
    );
  });

  it('6. disabling one option does not stop jobs allowed by the other', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    const catchupPgn = englishPgn(1, 'Catch');
    const importPgn = englishPgn(1, 'Imp');
    queue.setProvider(
      new FakePgnTranslationProvider({
        ...fakeMapFor(catchupPgn, 'repertoire', 'c1'),
        ...fakeMapFor(importPgn, 'gameLibrary', 'i1'),
      }),
    );
    await queue.enqueuePgn(catchupPgn, 'repertoire', 'c1', 'catchup');
    await queue.enqueuePgn(importPgn, 'gameLibrary', 'i1', 'import');
    queue.setPolicy({ catchup: false, import: true });
    await queue.pauseOrigins(['catchup']);
    const result = await queue.processUntilIdle();
    assert.equal(result.done, 1);
    const jobs = Object.values(queue.getSnapshot().jobs);
    assert.equal(jobs.find((j) => j.origin === 'catchup')?.status, 'paused');
    assert.equal(jobs.find((j) => j.origin === 'import')?.status, 'done');
  });

  it('7. recovers an interrupted 8 / 360 style queue without duplicates', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const firstQueue = new PgnTranslationQueue(kv, store);
    const pgn = englishPgn(12, 'Stuck');
    firstQueue.setProvider(new FakePgnTranslationProvider(fakeMapFor(pgn, 'repertoire', 'big')));
    await firstQueue.enqueuePgn(pgn, 'repertoire', 'big', 'catchup');
    const batch = await firstQueue.processNext(8);
    assert.equal(batch.done, 8);
    const raw = JSON.parse((await kv.getItem(StorageKeys.pgnTranslationQueue.key)) ?? '{}') as {
      jobs: Record<string, { status: string }>;
    };
    const runningId = Object.entries(raw.jobs).find(([, job]) => job.status === 'queued')?.[0];
    assert.ok(runningId);
    raw.jobs[runningId] = { ...raw.jobs[runningId], status: 'running' };
    await kv.setItem(StorageKeys.pgnTranslationQueue.key, JSON.stringify(raw));

    const remountedStore = new PgnCommentTranslationStore(kv);
    const remounted = new PgnTranslationQueue(kv, remountedStore);
    remounted.setProvider(new FakePgnTranslationProvider(fakeMapFor(pgn, 'repertoire', 'big')));
    const prefs = new PreferencesStore(kv);
    await prefs.update({ translateExistingPgnComments: false });
    await applyPgnTranslationPreferences({
      queue: remounted,
      preferences: prefs,
      start: false,
      collectFiles: async () => [{ source: 'repertoire', fileId: 'big', pgnText: pgn }],
    });
    const paused = remounted.getProgress();
    assert.equal(paused.translated, 8);
    assert.ok(paused.pending >= 4);
    assert.equal(paused.phase, 'paused');
    assert.ok(Object.values(remounted.getSnapshot().jobs).every((j) => j.status !== 'running'));

    await prefs.update({ translateExistingPgnComments: true });
    remounted.setProvider(new FakePgnTranslationProvider(fakeMapFor(pgn, 'repertoire', 'big')));
    await applyPgnTranslationPreferences({
      queue: remounted,
      preferences: prefs,
      waitForPump: true,
      collectFiles: async () => [{ source: 'repertoire', fileId: 'big', pgnText: pgn }],
    });
    const done = remounted.getProgress();
    assert.equal(done.translated, 12);
    assert.equal(done.pending, 0);
    assert.equal(done.phase, 'complete');
    assert.equal(Object.keys(remounted.getSnapshot().jobs).length, 12);
  });

  it('8. network, timeout and quota stay retryable and do not save English echoes', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store, { timeoutMs: 30 });
    const pgn = `[Event "Err"]\n\n1. e4 {White occupies the center.} *`;
    await queue.enqueuePgn(pgn, 'repertoire', 'err', 'catchup');

    queue.setProvider({
      configured: true,
      async translateComments(batch) {
        return batch.map((item) => ({ id: item.id, error: 'offline' as const }));
      },
    });
    const offline = await queue.processNext(1);
    assert.equal(offline.blocked, 'offline');
    assert.equal(store.getSnapshot().records['repertoire:err:0:n1:after'], undefined);

    queue.setProvider({
      configured: true,
      async translateComments() {
        return new Promise(() => {});
      },
    });
    const timeout = await queue.processNext(1);
    assert.equal(timeout.blocked, 'timeout');

    queue.setProvider({
      configured: true,
      async translateComments(batch) {
        return batch.map((item) => ({ id: item.id, error: 'quota' as const }));
      },
    });
    const quota = await queue.processNext(1);
    assert.equal(quota.blocked, 'quota');

    queue.setProvider({
      configured: true,
      async translateComments(batch) {
        return batch.map((item) => ({ id: item.id, text: item.text }));
      },
    });
    const echo = await queue.processNext(1);
    assert.equal(echo.done, 0);
    assert.ok(echo.failed >= 1);
    assert.equal(store.getSnapshot().records['repertoire:err:0:n1:after'], undefined);
    assert.equal(isEchoTranslation('White occupies the center.', 'White occupies the center.'), true);

    queue.setProvider(
      new FakePgnTranslationProvider({
        'White occupies the center.': 'Les Blancs occupent le centre.',
      }),
    );
    await queue.retryBlocked();
    const ok = await queue.processUntilIdle();
    assert.equal(ok.done, 1);
    assert.equal(
      store.getRecord({
        source: 'repertoire',
        fileId: 'err',
        gameIndex: 0,
        nodeId: 'n1',
        slot: 'after',
      })?.translatedText,
      'Les Blancs occupent le centre.',
    );
  });

  it('9-10. variations are collected and the original PGN plus eval stay intact', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    queue.setProvider(
      new FakePgnTranslationProvider({
        ...fakeMapFor(PGN_OPENING, 'repertoire', 'open-1'),
        ...fakeMapFor(PGN_PARTY, 'gameLibrary', 'party-1'),
      }),
    );
    await queue.enqueuePgn(PGN_OPENING, 'repertoire', 'open-1', 'catchup');
    await queue.enqueuePgn(PGN_PARTY, 'gameLibrary', 'party-1', 'import');
    const result = await queue.processUntilIdle();
    assert.equal(result.done, 3);
    assert.match(PGN_OPENING, /1\. e4/);
    assert.match(PGN_OPENING, /\[%eval 0\.12\]/);
    assert.match(PGN_PARTY, /Nf3/);
    assert.match(PGN_PARTY, /Nc3/);
    const evalUnit = collectPgnCommentUnits(PGN_OPENING, 'repertoire', 'open-1')[1]!;
    const evalRec = store.getRecord(evalUnit.anchor);
    assert.match(evalRec?.translatedText ?? '', /\[%eval 0\.12\]/);
    const exported = applyFrenchToPgnText(
      PGN_OPENING,
      [
        {
          original: evalUnit.original,
          french: evalRec?.translatedText ?? '',
        },
      ],
      'french',
    );
    assert.match(exported, /\[%eval 0\.12\]/);
    assert.equal(PGN_OPENING.includes('Black answers in kind.'), true);
  });

  it('11. Original / French defaults and offline remount', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    const original = 'White occupies the center.';
    queue.setProvider(new FakePgnTranslationProvider({ [original]: 'Les Blancs occupent le centre.' }));
    await queue.enqueuePgn(PGN_OPENING, 'repertoire', 'open-1', 'catchup');
    await queue.processNext(1);
    const remount = new PgnCommentTranslationStore(kv);
    await remount.ensureLoaded();
    const unit = collectPgnCommentUnits(PGN_OPENING, 'repertoire', 'open-1')[0]!;
    const rec = remount.getRecord(unit.anchor);
    assert.equal(rec?.translatedText, 'Les Blancs occupent le centre.');
    const frenchUi = resolvePgnComment(unit.anchor, original, 'fr', 'auto', remount);
    const englishUi = resolvePgnComment(unit.anchor, original, 'en', 'auto', remount);
    const forcedOriginal = resolvePgnComment(unit.anchor, original, 'fr', 'original', remount);
    assert.equal(frenchUi.showing, 'french');
    assert.equal(frenchUi.text, 'Les Blancs occupent le centre.');
    assert.equal(englishUi.showing, 'original');
    assert.equal(englishUi.text, original);
    assert.equal(forcedOriginal.showing, 'original');
    assert.equal(hasUsableFrenchTranslation(unit.anchor, original, remount), true);
  });

  it('does not mark queued or failed comments as already French', () => {
    const units = collectPgnCommentUnits(PGN_OPENING, 'repertoire', 'open-1');
    const info = describePgnFileTranslation('repertoire', 'open-1', PGN_OPENING);
    assert.equal(info.alreadyFrench, false);
    assert.ok(info.english > 0);
    assert.ok(units.some((unit) => unit.language === 'en'));
    const frenchOnly = describePgnFileTranslation(
      'repertoire',
      'fr-1',
      `[Event "FR"]\n\n1. e4 {Un pion central fort.} *`,
    );
    assert.equal(frenchOnly.english, 0);
    assert.equal(frenchOnly.alreadyFrench, true);
    const empty = describePgnFileTranslation('repertoire', 'empty', `[Event "X"]\n\n1. e4 e5 *`);
    assert.equal(empty.alreadyFrench, false);
  });

  it('background hold keeps completed work and resumes remaining jobs', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    const pgn = englishPgn(4, 'Bg');
    let calls = 0;
    queue.setProvider({
      configured: true,
      async translateComments(batch) {
        const out = [];
        for (const item of batch) {
          calls += 1;
          if (calls === 2) queue.setAppForeground(false);
          if (!queue.isAppForeground() && calls > 2) {
            out.push({ id: item.id, error: 'held' as const });
            continue;
          }
          out.push({ id: item.id, text: `FR ${item.text}` });
        }
        return out;
      },
    });
    await queue.enqueuePgn(pgn, 'repertoire', 'bg', 'catchup');
    const first = await queue.processUntilIdle();
    assert.ok(first.done >= 1);
    assert.equal(queue.getLastError(), null);
    const afterHold = Object.values(store.getSnapshot().records).filter((r) => r.status === 'ready');
    assert.ok(afterHold.length >= 1);
    const pending = Object.values(queue.getSnapshot().jobs).filter((j) => j.status !== 'done');
    assert.ok(pending.length >= 1);
    queue.setAppForeground(true);
    queue.setProvider(
      new FakePgnTranslationProvider(fakeMapFor(pgn, 'repertoire', 'bg')),
    );
    const rest = await queue.processUntilIdle();
    assert.ok(rest.done + first.done >= 4);
    assert.equal(queue.getProgress().phase, 'complete');
    assert.ok(calls < 8, 'must not re-send already translated comments in a tight loop');
  });

  it('HTTP 429-style throttle is not reported as a quota', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    const pgn = `[Event "RL"]\n\n1. e4 {White occupies the center.} *`;
    await queue.enqueuePgn(pgn, 'repertoire', 'rl', 'catchup');
    queue.setProvider({
      configured: true,
      async translateComments(batch) {
        return batch.map((item) => ({
          id: item.id,
          error: 'rate_limited' as const,
          retryAfterMs: 1,
        }));
      },
    });
    const result = await queue.processNext(1);
    assert.equal(result.blocked, 'rate_limited');
    assert.equal(queue.getLastError(), 'rate_limited');
    assert.notEqual(queue.getLastError(), 'quota');
    assert.equal(store.getSnapshot().records['repertoire:rl:0:n1:after'], undefined);
    assert.equal(queue.getSnapshot().jobs['repertoire:rl:0:n1:after']?.status, 'queued');
  });

  it('12. libraries no longer mount the old translation panels', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const mobileRoot = join(here, '../../..');
    const manage = readFileSync(join(mobileRoot, 'app/openings/manage.tsx'), 'utf8');
    const parties = readFileSync(join(mobileRoot, 'app/parties/index.tsx'), 'utf8');
    const settings = readFileSync(join(mobileRoot, 'app/parametres.tsx'), 'utf8');
    assert.doesNotMatch(manage, /PgnTranslationActions|PgnFileTranslateButton|opening-pgn-translation/);
    assert.doesNotMatch(parties, /PgnTranslationActions|parties-pgn-translation/);
    assert.match(settings, /PgnTranslationSettingsSection/);
  });
});
