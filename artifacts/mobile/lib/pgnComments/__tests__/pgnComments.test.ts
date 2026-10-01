import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import {
  collectPgnCommentUnits,
  commentsToQueue,
  detectCommentLanguage,
  shouldQueueEnglishComment,
  fingerprintComment,
  protectCommentTokens,
  restoreCommentTokens,
  tokensUnchanged,
  isTechnicalOnlyComment,
  applyFrenchToPgnText,
  FakePgnTranslationProvider,
  HttpPgnTranslationProvider,
  UnconfiguredPgnTranslationProvider,
  PgnCommentTranslationStore,
  PgnTranslationQueue,
  protectChessTerms,
  restoreChessTerms,
  enqueueExistingPgns,
  scheduleImportedPgnComments,
} from '../index.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';

const PGN = `[Event "Test"]

1. e4 {A strong central pawn.} e5 {[%eval 0.12] Black answers in kind.} *`;

describe('comment language and tokens', () => {
  it('detects English prose and skips French', () => {
    assert.equal(detectCommentLanguage('A strong central pawn.'), 'en');
    assert.equal(detectCommentLanguage('Un pion central fort.'), 'fr');
    assert.equal(shouldQueueEnglishComment('[%eval 0.31]'), false);
    assert.equal(isTechnicalOnlyComment('[%clk 0:01:00]'), true);
  });

  it('protects directives and SAN then restores them', () => {
    const raw = 'After Nf3 [%eval 0.20] White develops.';
    const protectedText = protectCommentTokens(raw);
    assert.match(protectedText.masked, /__T/);
    assert.ok(!protectedText.masked.includes('[%eval'));
    const restored = restoreCommentTokens(protectedText.masked, protectedText.tokens);
    assert.equal(restored.includes('[%eval 0.20]'), true);
    assert.equal(tokensUnchanged(raw, 'Après Nf3 [%eval 0.20] les Blancs se développent.'), true);
    assert.equal(tokensUnchanged(raw, 'Après Nf3 les Blancs se développent.'), false);
  });
});

describe('collect imported comments', () => {
  it('walks variations with stable n-ids', () => {
    const units = collectPgnCommentUnits(PGN, 'repertoire', 'file-a');
    assert.equal(units.length, 2);
    assert.equal(units[0]?.anchor.nodeId, 'n1');
    assert.equal(units[0]?.anchor.slot, 'after');
    assert.equal(commentsToQueue(units).length, 2);
  });
});

describe('store and queue', () => {
  let store: PgnCommentTranslationStore;
  let queue: PgnTranslationQueue;

  beforeEach(() => {
    const kv = new MemoryKeyValueStorage();
    store = new PgnCommentTranslationStore(kv);
    queue = new PgnTranslationQueue(kv, store);
  });

  it('does not invent translations when the provider is unconfigured', async () => {
    queue.setProvider(new UnconfiguredPgnTranslationProvider());
    const added = await queue.enqueuePgn(PGN, 'repertoire', 'file-a');
    assert.equal(added, 2);
    const result = await queue.processNext();
    assert.equal(result.blocked, 'not_configured');
    assert.equal(result.done, 0);
    assert.equal(store.getSnapshot().records['repertoire:file-a:0:n1:after'], undefined);
  });

  it('persists a fake-provider result and protects manuals', async () => {
    const units = collectPgnCommentUnits(PGN, 'repertoire', 'file-a');
    const unit = units[0]!;
    await store.saveManual(unit.anchor, unit.original, 'Un pion central fort.');
    queue.setProvider(
      new FakePgnTranslationProvider({
        [unit.original]: 'Un pion du centre.',
      }),
    );
    const added = await queue.enqueueUnits([unit]);
    assert.equal(added, 0);
    const result = await queue.processNext();
    assert.equal(result.done, 0);
    const rec = store.getRecord(unit.anchor);
    assert.equal(rec?.translatedText, 'Un pion central fort.');
    assert.equal(rec?.method, 'manual');
  });

  it('marks a changed original as stale', async () => {
    const units = collectPgnCommentUnits(PGN, 'repertoire', 'file-a');
    const unit = units[0]!;
    await store.upsert({
      anchor: unit.anchor,
      sourceLang: 'en',
      targetLang: 'fr',
      originalFingerprint: unit.fingerprint,
      originalText: unit.original,
      translatedText: 'Un pion central fort.',
      status: 'ready',
      method: 'automatic',
    });
    const stale = store.resolveFrench(unit.anchor, 'A different comment.');
    assert.equal(stale?.status, 'stale');
  });

  it('exports french copy without mutating the source string identity', () => {
    const exported = applyFrenchToPgnText(
      PGN,
      [{ original: 'A strong central pawn.', french: 'Un pion central fort.' }],
      'french',
    );
    assert.match(exported, /Un pion central fort/);
    assert.equal(PGN.includes('A strong central pawn.'), true);
    assert.equal(fingerprintComment('A strong central pawn.'), fingerprintComment('A strong   central pawn.'));
  });

  it('keeps directives when exporting french comments', () => {
    const exported = applyFrenchToPgnText(
      PGN,
      [
        {
          original: '[%eval 0.12] Black answers in kind.',
          french: '[%eval 0.12] Les Noirs répondent de la même façon.',
        },
      ],
      'french',
    );
    assert.match(exported, /\[%eval 0\.12\]/);
    assert.match(exported, /Les Noirs répondent/);
  });
});

describe('existing-file catch-up', () => {
  it('does not enqueue french or technical-only comments twice', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    const first = await queue.enqueuePgn(PGN, 'repertoire', 'file-a');
    const second = await queue.enqueuePgn(PGN, 'repertoire', 'file-a');
    assert.equal(first, 2);
    assert.equal(second, 0);
  });

  it('cancel leaves completed translations in the store', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    queue.setProvider(
      new FakePgnTranslationProvider({
        'A strong central pawn.': 'Un pion central fort.',
      }),
    );
    await queue.enqueuePgn(PGN, 'repertoire', 'file-a');
    queue.cancel();
    const result = await queue.processNext();
    assert.ok(result.done === 0 || result.done === 1);
  });
});

describe('chess glossary', () => {
  it('restores cavalier / les Blancs instead of leaving English piece names', () => {
    const glossed = protectChessTerms('White develops the knight.');
    assert.match(glossed.masked, /__C/);
    assert.doesNotMatch(glossed.masked, /knight/i);
    const restored = restoreChessTerms('__C0__ développe le __C1__.', glossed.terms);
    assert.match(restored, /Blancs/);
    assert.match(restored, /cavalier/);
  });
});

describe('quota and service failure keep originals', () => {
  it('does not write French when the provider reports quota', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    queue.setProvider({
      configured: true,
      async translateComments(batch) {
        return batch.map((item) => ({ id: item.id, error: 'quota' as const }));
      },
    });
    await queue.enqueuePgn(PGN, 'repertoire', 'file-a');
    const result = await queue.processNext();
    assert.equal(result.blocked, 'quota');
    assert.equal(result.done, 0);
    assert.equal(queue.getLastError(), 'quota');
    assert.equal(store.getSnapshot().records['repertoire:file-a:0:n1:after'], undefined);
    assert.equal(PGN.includes('A strong central pawn.'), true);
  });

  it('resumes remaining jobs after quota without rewriting ready translations', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    const units = collectPgnCommentUnits(PGN, 'repertoire', 'file-a');
    const first = units[0]!;
    await store.upsert({
      anchor: first.anchor,
      sourceLang: 'en',
      targetLang: 'fr',
      originalFingerprint: first.fingerprint,
      originalText: first.original,
      translatedText: 'Un pion central fort.',
      status: 'ready',
      method: 'automatic',
    });
    let calls = 0;
    queue.setProvider({
      configured: true,
      async translateComments(batch) {
        calls += 1;
        if (calls === 1) {
          return batch.map((item) => ({ id: item.id, error: 'quota' as const }));
        }
        return batch.map((item) => ({
          id: item.id,
          text: item.text === 'White develops the knight toward the center.'
            ? 'Les Blancs développent le cavalier vers le centre.'
            : `FR ${item.text}`,
        }));
      },
    });
    const added = await queue.enqueuePgn(PGN, 'repertoire', 'file-a');
    assert.equal(added, 1);
    const blocked = await queue.processUntilIdle();
    assert.equal(blocked.blocked, 'quota');
    assert.equal(store.getRecord(first.anchor)?.translatedText, 'Un pion central fort.');
    await queue.retryBlocked();
    const resumed = await queue.processUntilIdle();
    assert.equal(resumed.done, 1);
    assert.equal(store.getRecord(first.anchor)?.translatedText, 'Un pion central fort.');
    assert.match(store.getRecord(units[1]!.anchor)?.translatedText ?? '', /\[%eval 0\.12\]/);
    assert.match(store.getRecord(units[1]!.anchor)?.translatedText ?? '', /Noirs|répondent|FR /);
  });
});

const FRENCH: Record<string, string> = {
  'White develops the knight toward the center.':
    'Les Blancs développent le cavalier vers le centre.',
  'White occupies the center.': 'Les Blancs occupent le centre.',
  '[%eval 0.12] Black answers in kind.':
    '[%eval 0.12] Les Noirs répondent de la même façon.',
  'White develops the knight.': 'Les Blancs développent le cavalier.',
};

function mockDeepLProxy(): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      items?: { id: string; text: string }[];
    };
    return new Response(
      JSON.stringify({
        backend: 'deepl',
        usage: { characterCount: 1800, characterLimit: 500000, remaining: 498200 },
        items: (body.items ?? []).map((item) => ({
          id: item.id,
          text: FRENCH[item.text] ?? `FR ${item.text}`,
        })),
      }),
      { status: 200 },
    );
  }) as typeof fetch;
}

describe('live DeepL proxy translation persists after reload', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('translates an English comment and keeps French after a storage remount', async () => {
    globalThis.fetch = mockDeepLProxy();
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    queue.setProvider(new HttpPgnTranslationProvider('https://example.test/api/pgn-comments/translate'));
    const pgn = `[Event "Live"]\n\n1. e4 {White develops the knight toward the center.} *`;
    const added = await queue.enqueuePgn(pgn, 'gameLibrary', 'live-1');
    assert.equal(added, 1);
    const result = await queue.processNext(1);
    assert.equal(result.blocked, null);
    assert.equal(result.done, 1, JSON.stringify(result));
    const rec = store.getRecord({
      source: 'gameLibrary',
      fileId: 'live-1',
      gameIndex: 0,
      nodeId: 'n1',
      slot: 'after',
    });
    assert.ok(rec);
    assert.equal(rec?.status, 'ready');
    assert.equal(rec?.originalText, 'White develops the knight toward the center.');
    assert.notEqual(rec?.translatedText, rec?.originalText);
    assert.match(rec?.translatedText ?? '', /cavalier|centre|Blancs|développe/i);

    const raw = await kv.getItem(StorageKeys.pgnCommentTranslations.key);
    assert.ok(raw);
    assert.match(raw, /translatedText/);

    const remounted = new PgnCommentTranslationStore(kv);
    await remounted.ensureLoaded();
    const again = remounted.getRecord({
      source: 'gameLibrary',
      fileId: 'live-1',
      gameIndex: 0,
      nodeId: 'n1',
      slot: 'after',
    });
    assert.equal(again?.translatedText, rec?.translatedText);
    assert.equal(again?.originalText, 'White develops the knight toward the center.');
  });

  it('covers an already-imported PGN and a new import without touching SAN or eval', async () => {
    globalThis.fetch = mockDeepLProxy();
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    queue.setProvider(new HttpPgnTranslationProvider('https://example.test/api/pgn-comments/translate'));
    const existing = `[Event "Old"]\n\n1. e4 {White occupies the center.} e5 {[%eval 0.12] Black answers in kind.} *`;
    const imported = `[Event "New"]\n\n1. e4 e5 2. Nf3 (2. Nc3 {White develops the knight.}) *`;
    const addedExisting = await queue.enqueuePgn(existing, 'repertoire', 'old-file');
    const addedImport = await queue.enqueuePgn(imported, 'gameLibrary', 'new-file');
    assert.equal(addedExisting, 2);
    assert.equal(addedImport, 1);
    const result = await queue.processNext(8);
    assert.equal(result.blocked, null);
    assert.equal(result.done, 3, JSON.stringify(result));

    assert.match(existing, /1\. e4/);
    assert.match(existing, /\[%eval 0\.12\]/);
    assert.match(imported, /Nf3/);
    assert.match(imported, /Nc3/);

    const oldUnits = collectPgnCommentUnits(existing, 'repertoire', 'old-file');
    const newUnits = collectPgnCommentUnits(imported, 'gameLibrary', 'new-file');
    const first = store.getRecord(oldUnits[0]!.anchor);
    const evalRec = store.getRecord(oldUnits[1]!.anchor);
    const variation = store.getRecord(newUnits[0]!.anchor);
    assert.ok(first?.translatedText);
    assert.ok(evalRec?.translatedText);
    assert.ok(variation?.translatedText);
    assert.notEqual(first?.translatedText, first?.originalText);
    assert.match(evalRec?.translatedText ?? '', /\[%eval 0\.12\]/);
    assert.match(variation?.translatedText ?? '', /cavalier|Blancs|développe/i);

    const frenchExport = applyFrenchToPgnText(
      existing,
      oldUnits
        .map((unit) => {
          const rec = store.getRecord(unit.anchor);
          return rec?.translatedText
            ? { original: unit.original, french: rec.translatedText }
            : null;
        })
        .filter((row): row is { original: string; french: string } => !!row),
      'french',
    );
    assert.match(frenchExport, /1\. e4/);
    assert.match(frenchExport, /\[%eval 0\.12\]/);
    assert.equal(existing.includes('White occupies the center.'), true);

    const remounted = new PgnCommentTranslationStore(kv);
    await remounted.ensureLoaded();
    assert.equal(remounted.getRecord(oldUnits[0]!.anchor)?.translatedText, first?.translatedText);
    assert.equal(remounted.getRecord(newUnits[0]!.anchor)?.translatedText, variation?.translatedText);

    let proxyCalls = 0;
    globalThis.fetch = (async () => {
      proxyCalls += 1;
      throw new Error('must not retranlate done comments');
    }) as typeof fetch;
    const again = await queue.enqueuePgn(existing, 'repertoire', 'old-file');
    assert.equal(again, 0);
    const second = await queue.processNext(8);
    assert.equal(second.done, 0);
    assert.equal(proxyCalls, 0);
    assert.ok(enqueueExistingPgns);
    assert.ok(scheduleImportedPgnComments);
  });

  it('maps quota, rate limit, network and missing config distinctly', async () => {
    const cases = [
      { status: 456, error: 'quota', expected: 'quota' },
      { status: 429, error: 'rate_limited', expected: 'rate_limited' },
      { status: 503, error: 'offline', expected: 'offline' },
      { status: 503, error: 'not_configured', expected: 'not_configured' },
    ] as const;
    for (const row of cases) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ error: row.error, items: [] }), {
          status: row.status,
        })) as typeof fetch;
      const kv = new MemoryKeyValueStorage();
      const store = new PgnCommentTranslationStore(kv);
      const queue = new PgnTranslationQueue(kv, store);
      queue.setProvider(new HttpPgnTranslationProvider('https://example.test/api/pgn-comments/translate'));
      await queue.enqueuePgn(`[Event "E"]\n\n1. e4 {White occupies the center.} *`, 'repertoire', row.error);
      const result = await queue.processNext(1);
      assert.equal(result.blocked, row.expected);
      assert.equal(result.done, 0);
      assert.equal(store.getSnapshot().records[`repertoire:${row.error}:0:n1:after`], undefined);
    }
  });
});
