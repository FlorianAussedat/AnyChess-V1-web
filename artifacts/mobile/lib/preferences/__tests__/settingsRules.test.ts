import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { PreferencesStore } from '../PreferencesStore.ts';
import { mergeUserPreferences } from '../../cloud/mergeDocuments.ts';
import { activeDictationLanguage } from '../../speech/voskModels.ts';
import { formatSanForDisplay } from '../../chess/notation.ts';
import { translate, speechLocaleForLanguage } from '../../i18n/messages.ts';
import { verbalMove } from '../../chessParser.ts';
import { snapDiscreteValue } from '../discreteValue.ts';
import { STOCKFISH_STRENGTH_BANDS } from '../../difficulty/StockfishStrengthBands.ts';
import { PUZZLE_RATING_BANDS_SELECTABLE } from '../../puzzles/puzzleBands.ts';

describe('single language and legacy/cloud restoration', () => {
  it('aligns a new English device, persists both languages, and keeps PGN SAN standard', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new PreferencesStore(storage, { deviceLanguage: () => 'en' });
    assert.equal((await store.ensureLoaded()).chessNotation, 'en');
    for (const language of ['fr', 'en'] as const) {
      await store.update({ language });
      const prefs = await new PreferencesStore(storage).ensureLoaded();
      assert.equal(prefs.language, language);
      assert.equal(prefs.chessNotation, language);
      assert.equal(prefs.dictationLanguage, language);
      assert.equal(
        activeDictationLanguage({
          language,
          dictationLanguage: language === 'en' ? 'fr' : 'en',
        }),
        language,
      );
      assert.equal(
        speechLocaleForLanguage(prefs.language),
        language === 'fr' ? 'fr-FR' : 'en-US',
      );
      assert.equal(
        translate(prefs.language, 'settings.title'),
        language === 'fr' ? 'Paramètres' : 'Settings',
      );
      const game = new Chess();
      const move = game.move('Nf3');
      assert.equal(
        formatSanForDisplay(move.san, prefs.chessNotation),
        language === 'fr' ? 'Cf3' : 'Nf3',
      );
      assert.match(
        verbalMove(move, language),
        language === 'fr' ? /cavalier/i : /knight/i,
      );
      assert.deepEqual(game.history(), ['Nf3']);
      const restored = new Chess();
      restored.loadPgn(game.pgn());
      assert.deepEqual(restored.history(), ['Nf3']);
    }
  });

  it('migrates divergent legacy aliases without losing other preferences or timestamps', async () => {
    const storage = new MemoryKeyValueStorage();
    const old = {
      language: 'en',
      chessNotation: 'fr',
      dictationLanguage: 'fr',
      syncOnWifiOnly: true,
      voiceEnabled: false,
      coordinatesEnabled: false,
      voiceSpeed: 8,
      dictationPace: 'slow',
      visualProblemDifficulty: 'all',
      blindProblemDifficulty: '800-999',
      chessInputMode: 'keypad',
      stockfishStrengthBandId: '1200-1400',
      translateExistingPgnComments: true,
      translateImportedPgnComments: true,
      updatedAt: '2026-01-01T00:00:00Z',
    };
    await storage.setItem(StorageKeys.userPreferences.key, JSON.stringify(old));
    const store = new PreferencesStore(storage);
    const prefs = await store.ensureLoaded();
    for (const [key, value] of Object.entries(old)) {
      if (
        !['chessNotation', 'dictationLanguage', 'syncOnWifiOnly'].includes(key)
      )
        assert.equal(prefs[key as keyof typeof prefs], value, key);
    }
    assert.equal(prefs.chessNotation, 'en');
    assert.equal(prefs.dictationLanguage, 'en');
    assert.equal(prefs.syncOnWifiOnly, false);
    assert.equal(
      JSON.parse((await storage.getItem(StorageKeys.userPreferences.key))!)
        .dictationLanguage,
      'en',
    );
    await store.update({
      dictationLanguage: 'fr',
      chessNotation: 'fr',
      syncOnWifiOnly: true,
    });
    assert.equal(store.getPreferences().dictationLanguage, 'en');
    assert.equal(store.getPreferences().chessNotation, 'en');
    assert.equal(store.getPreferences().syncOnWifiOnly, false);
  });

  it('normalizes restored cloud documents and preserves a guest’s explicit language in a field merge', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new PreferencesStore(storage, { deviceLanguage: () => 'fr' });
    await store.ensureLoaded();
    const cloud = {
      language: 'en',
      chessNotation: 'fr',
      dictationLanguage: 'fr',
      syncOnWifiOnly: true,
      voiceEnabled: false,
      updatedAt: '2026-01-01T00:00:00Z',
    };
    await storage.setItem(
      StorageKeys.userPreferences.key,
      JSON.stringify(mergeUserPreferences(store.getPreferences(), cloud)),
    );
    assert.equal((await store.reloadFromStorage()).dictationLanguage, 'en');
    assert.equal(store.getPreferences().voiceEnabled, false);
    // A fresh guest intentionally chooses French, even though its original default was French.
    const guest = new PreferencesStore(new MemoryKeyValueStorage(), {
      deviceLanguage: () => 'fr',
    });
    await guest.update({ language: 'fr' });
    const merged = mergeUserPreferences(
      guest.getPreferences(),
      cloud,
    ) as Record<string, unknown>;
    await storage.setItem(
      StorageKeys.userPreferences.key,
      JSON.stringify(merged),
    );
    const prefs = await store.reloadFromStorage();
    assert.equal(prefs.language, 'fr');
    assert.equal(prefs.chessNotation, 'fr');
    assert.equal(prefs.dictationLanguage, 'fr');
    assert.equal(prefs.voiceEnabled, false);
  });
});

describe('valid discrete difficulty steps', () => {
  it('snaps and clamps every puzzle/Stockfish level, including invalid touch values', () => {
    for (const bands of [
      STOCKFISH_STRENGTH_BANDS,
      PUZZLE_RATING_BANDS_SELECTABLE,
    ]) {
      for (let i = 0; i < bands.length; i++)
        assert.equal(snapDiscreteValue(i, 0, bands.length - 1), i);
      assert.equal(snapDiscreteValue(-20, 0, bands.length - 1), 0);
      assert.equal(
        snapDiscreteValue(100, 0, bands.length - 1),
        bands.length - 1,
      );
      assert.equal(snapDiscreteValue(2.8, 0, bands.length - 1), 3);
      assert.equal(snapDiscreteValue(NaN, 0, bands.length - 1), 0);
    }
    assert.equal(snapDiscreteValue(4, 1, 10, 2), 5);
    assert.equal(snapDiscreteValue(10, 1, 10, 2), 9);
  });
});
