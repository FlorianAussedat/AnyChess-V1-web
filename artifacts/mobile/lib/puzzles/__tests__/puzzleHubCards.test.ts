/**
 * Puzzle hub cards + default difficulty preferences.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import {
  PreferencesStore,
  defaultUserPreferences,
  mergePreferencesDocument,
} from '../../preferences/PreferencesStore.ts';
import { DEFAULT_PUZZLE_RATING_BAND_ID } from '../puzzleBands.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('Puzzle hub card category page', () => {
  it('keeps Problèmes / Visualisation title and uses HubModeCard cards', () => {
    const hub = read('components/puzzles/PuzzleHubPhase.tsx');
    const route = read('app/puzzles/index.tsx');
    assert.match(hub, /puzzle\.hubTitle/);
    assert.match(hub, /HubModeCard/);
    assert.match(hub, /puzzle-card-visual/);
    assert.match(hub, /puzzle-card-blind/);
    assert.match(hub, /BrandAssets\.exercises\.problemesVisuels/);
    assert.match(hub, /BrandAssets\.exercises\.problemesAveugle/);
    assert.match(hub, /selectSubmode\('visual'\)/);
    assert.match(hub, /selectSubmode\('blind'\)/);
    assert.doesNotMatch(hub, /iconName=/);
    assert.doesNotMatch(hub, /PuzzleFilterChip/);
    assert.doesNotMatch(hub, /PuzzleRatingBandSlider/);
    assert.match(route, /PuzzleSettingsPhase/);
    assert.match(route, /case 'settings'/);
  });

  it('settings phase owns difficulty controls seeded from preferences', () => {
    const settings = read('components/puzzles/PuzzleSettingsPhase.tsx');
    const ctx = read('contexts/PuzzleContext.tsx');
    assert.match(settings, /PuzzleRatingBandSlider/);
    assert.match(settings, /puzzle\.difficultyDefaultHint/);
    assert.match(settings, /puzzle-start/);
    assert.match(ctx, /visualProblemDifficulty/);
    assert.match(ctx, /blindProblemDifficulty/);
    assert.match(ctx, /setPhase\('settings'\)/);
  });
});

describe('puzzle difficulty preferences', () => {
  it('defaults both modes to the current puzzle default band', () => {
    const d = defaultUserPreferences();
    assert.equal(d.visualProblemDifficulty, DEFAULT_PUZZLE_RATING_BAND_ID);
    assert.equal(d.blindProblemDifficulty, DEFAULT_PUZZLE_RATING_BAND_ID);
  });

  it('persists visual and blind difficulties independently', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new PreferencesStore(storage);
    await store.ensureLoaded();
    await store.update({
      visualProblemDifficulty: '1000-1199',
      blindProblemDifficulty: '1800-1999',
    });
    const again = new PreferencesStore(storage);
    await again.ensureLoaded();
    assert.equal(again.getPreferences().visualProblemDifficulty, '1000-1199');
    assert.equal(again.getPreferences().blindProblemDifficulty, '1800-1999');
  });

  it('falls back safely when difficulty keys are missing or invalid', () => {
    const merged = mergePreferencesDocument({
      language: 'en',
      visualProblemDifficulty: 'not-a-band',
    });
    assert.ok(merged);
    assert.equal(merged!.visualProblemDifficulty, DEFAULT_PUZZLE_RATING_BAND_ID);
    assert.equal(merged!.blindProblemDifficulty, DEFAULT_PUZZLE_RATING_BAND_ID);

    const legacy = mergePreferencesDocument({
      language: 'fr',
      voiceSpeed: 5,
    });
    assert.ok(legacy);
    assert.equal(legacy!.visualProblemDifficulty, DEFAULT_PUZZLE_RATING_BAND_ID);
    assert.equal(legacy!.blindProblemDifficulty, DEFAULT_PUZZLE_RATING_BAND_ID);
  });

  it('local setRatingBand does not write preferences in PuzzleContext', () => {
    const ctx = read('contexts/PuzzleContext.tsx');
    // setRatingBand only updates local state / filters
    assert.match(
      ctx,
      /const setRatingBand = useCallback\(\s*\(bandId: string\) => \{\s*setRatingBandId\(bandId\)/,
    );
    assert.doesNotMatch(ctx, /setRatingBand[\s\S]*updatePreferences/);
    assert.doesNotMatch(ctx, /setRatingBand[\s\S]*visualProblemDifficulty:/);
  });
});
