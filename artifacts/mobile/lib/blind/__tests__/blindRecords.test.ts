/**
 * Mémorisation records — eligibility, perfect sessions, storage.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { BlindRecordsStore } from '../BlindRecordsStore.ts';
import {
  blindRecordFullMoves,
  evaluateBlindRecordResult,
  isBlindRecordEligible,
  isBlindSessionPerfect,
} from '../recordEligibility.ts';
import { halfMoveCount, type BlindAttemptRecord } from '../types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '../../../components/blind');

describe('halfMoveCount / full-move slider mapping', () => {
  it('maps 1–20 full moves to discrete half-move counts', () => {
    assert.equal(halfMoveCount(1), 2);
    assert.equal(halfMoveCount(3), 6);
    assert.equal(halfMoveCount(20), 40);
    assert.equal(halfMoveCount(0), 2); // clamped min 1
    assert.equal(halfMoveCount(99), 40); // clamped max 20
  });

  it('exposes exactly 20 discrete integer stops from 1 to 20', () => {
    const stops = Array.from({ length: 20 }, (_, i) => i + 1);
    assert.equal(stops.length, 20);
    assert.equal(stops[0], 1);
    assert.equal(stops[19], 20);
    for (const n of stops) {
      assert.equal(halfMoveCount(n), n * 2);
    }
  });
});

describe('blind record eligibility', () => {
  it('stays eligible with only recognition failures', () => {
    const attempts: BlindAttemptRecord[] = [
      { expectedIndex: 0, kind: 'recognition-failure' },
    ];
    assert.equal(isBlindRecordEligible(attempts), true);
  });

  it('first wrong answer voids eligibility permanently', () => {
    const attempts: BlindAttemptRecord[] = [
      { expectedIndex: 0, kind: 'wrong-move', attemptedSan: 'e5' },
    ];
    assert.equal(isBlindRecordEligible(attempts), false);
    // Later corrections do not restore eligibility — attempts still include the mistake.
    attempts.push({ expectedIndex: 0, kind: 'recognition-failure' });
    assert.equal(isBlindRecordEligible(attempts), false);
  });

  it('help and skip (stored as help) void eligibility', () => {
    assert.equal(isBlindRecordEligible([{ kind: 'help' }]), false);
    assert.equal(
      isBlindRecordEligible([{ kind: 'help' }, { kind: 'recognition-failure' }]),
      false,
    );
  });

  it('perfect 3 full moves yields record 3; later 4 does not beat 5', () => {
    const firstOk = [true, true, true, true, true, true];
    const eval3 = evaluateBlindRecordResult(
      'listen-reconstruct',
      6,
      firstOk,
      [],
      0,
    );
    assert.equal(eval3.perfect, true);
    assert.equal(eval3.fullMoves, 3);
    assert.equal(eval3.isNewRecord, true);

    const eval5 = evaluateBlindRecordResult(
      'listen-reconstruct',
      10,
      Array(10).fill(true),
      [],
      3,
    );
    assert.equal(eval5.isNewRecord, true);
    assert.equal(eval5.nextBest, 5);

    const eval4 = evaluateBlindRecordResult(
      'listen-reconstruct',
      8,
      Array(8).fill(true),
      [],
      5,
    );
    assert.equal(eval4.isNewRecord, false);
    assert.equal(eval4.nextBest, 5);
  });

  it('mistake then perfect completion is not a record', () => {
    const attempts: BlindAttemptRecord[] = [
      { expectedIndex: 0, kind: 'wrong-piece', attemptedSan: 'Nf3' },
    ];
    const firstOk = [false, true, true, true, true, true];
    const result = evaluateBlindRecordResult(
      'watch-recite',
      6,
      firstOk,
      attempts,
      0,
    );
    assert.equal(result.eligible, false);
    assert.equal(result.perfect, false);
    assert.equal(result.isNewRecord, false);
  });

  it('White and Black perspectives share the same mode bucket logic', () => {
    // Perspective is not a parameter — same evaluation for either board orientation.
    const a = evaluateBlindRecordResult(
      'listen-reconstruct',
      6,
      Array(6).fill(true),
      [],
      0,
    );
    const b = evaluateBlindRecordResult(
      'listen-reconstruct',
      6,
      Array(6).fill(true),
      [],
      0,
    );
    assert.deepEqual(a, b);
    assert.equal(blindRecordFullMoves(6), 3);
  });

  it('listen and watch modes are independent in storage', async () => {
    const mem = new MemoryKeyValueStorage();
    const store = new BlindRecordsStore(mem);
    await store.saveFullMoves('listen-reconstruct', 8);
    await store.saveFullMoves('watch-recite', 5);
    assert.equal(await store.loadBest('listen-reconstruct'), 8);
    assert.equal(await store.loadBest('watch-recite'), 5);
    await store.saveFullMoves('listen-reconstruct', 4);
    assert.equal(await store.loadBest('listen-reconstruct'), 8);
    await store.saveFullMoves('watch-recite', 9);
    assert.equal(await store.loadBest('watch-recite'), 9);
  });

  it('isBlindSessionPerfect requires first-try accuracy and eligibility', () => {
    assert.equal(isBlindSessionPerfect([true, true], []), true);
    assert.equal(isBlindSessionPerfect([true, false], []), false);
    assert.equal(
      isBlindSessionPerfect([true, true], [{ kind: 'help' }]),
      false,
    );
  });
});

describe('blind memory UX opt-ins', () => {
  it('opts Observation / Reconstruction / Results into wide board sizing', () => {
    for (const file of [
      'BlindObservingPhase.tsx',
      'BlindReconstructionPhase.tsx',
      'BlindResultsPhase.tsx',
    ]) {
      const src = readFileSync(join(componentsDir, file), 'utf8');
      assert.match(src, /useBoardSize\('wide'\)/);
      assert.match(src, /sizeMode=["']wide["']/);
    }
  });

  it('keeps microphone actions on Reconstruction and Récitation', () => {
    const reconstruction = readFileSync(
      join(componentsDir, 'BlindReconstructionPhase.tsx'),
      'utf8',
    );
    const recitation = readFileSync(
      join(componentsDir, 'BlindRecitationPhase.tsx'),
      'utf8',
    );
    assert.match(reconstruction, /GameMicButton/);
    assert.match(reconstruction, /blind-reconstruction-mic/);
    assert.match(recitation, /GameMicButton/);
    assert.match(recitation, /blind-recitation-mic/);
    assert.doesNotMatch(recitation, /ear-outline|hiddenCard/);
  });

  it('exposes clear dictation and observation turn-taking copy', () => {
    const dictation = readFileSync(
      join(componentsDir, 'BlindDictationPhase.tsx'),
      'utf8',
    );
    const observing = readFileSync(
      join(componentsDir, 'BlindObservingPhase.tsx'),
      'utf8',
    );
    assert.match(dictation, /blind\.dictationInProgress/);
    assert.match(dictation, /blind\.dictationDone/);
    assert.match(dictation, /blind\.yourTurn/);
    assert.match(observing, /blind\.observationProgress/);
    assert.match(observing, /blind\.sequenceDone/);
    assert.match(observing, /blind\.yourTurnRecite/);
  });
});
