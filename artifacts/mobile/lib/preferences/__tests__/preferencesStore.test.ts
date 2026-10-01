/**
 * PreferencesStore — unified prefs + legacy migration + field-level fallback.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import {
  PreferencesStore,
  defaultUserPreferences,
  mergePreferencesDocument,
} from '../PreferencesStore.ts';
import { appLanguageFromTag } from '../deviceLanguage.ts';
import { DEFAULT_VOICE_SPEED } from '../../continueLine/voiceSpeed.ts';

describe('mergePreferencesDocument', () => {
  it('keeps valid fields when one property is malformed', () => {
    const merged = mergePreferencesDocument({
      version: 1,
      language: 'en',
      chessNotation: 'fr',
      voiceEnabled: false,
      coordinatesEnabled: 'nope',
      voiceSpeed: 9,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.ok(merged);
    assert.equal(merged!.language, 'en');
    assert.equal(merged!.chessNotation, 'fr');
    assert.equal(merged!.voiceEnabled, false);
    assert.equal(merged!.coordinatesEnabled, true); // default
    assert.equal(merged!.voiceSpeed, 9);
  });
});

describe('PreferencesStore', () => {
  it('defaults and persists language / notation independently', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new PreferencesStore(storage, { deviceLanguage: () => 'fr' });
    await store.ensureLoaded();
    const d = defaultUserPreferences();
    assert.equal(store.getPreferences().language, d.language);
    assert.equal(store.getPreferences().chessNotation, d.chessNotation);

    await store.update({ language: 'en', chessNotation: 'fr' });
    const again = new PreferencesStore(storage);
    await again.ensureLoaded();
    assert.equal(again.getPreferences().language, 'en');
    assert.equal(again.getPreferences().chessNotation, 'fr');
  });

  it('migrates legacy voice / coords / speed keys', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem(StorageKeys.voiceEnabled.key, '0');
    await storage.setItem(StorageKeys.boardCoordinatesVisible.key, '0');
    await storage.setItem(StorageKeys.defaultVoiceSpeed.key, '8');

    const store = new PreferencesStore(storage);
    await store.ensureLoaded();
    const prefs = store.getPreferences();
    assert.equal(prefs.voiceEnabled, false);
    assert.equal(prefs.coordinatesEnabled, false);
    assert.equal(prefs.voiceSpeed, 8);

    const raw = await storage.getItem(StorageKeys.userPreferences.key);
    assert.ok(raw);
    const parsed = JSON.parse(raw!) as { voiceEnabled: boolean };
    assert.equal(parsed.voiceEnabled, false);
  });

  it('migrates legacy soundEnabled key into voiceEnabled', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem(StorageKeys.voiceEnabledLegacy.key, '0');
    const store = new PreferencesStore(storage);
    await store.ensureLoaded();
    assert.equal(store.getPreferences().voiceEnabled, false);
  });

  it('resetPreferences restores defaults without clearing other storage', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem('keep-me', '1');
    const store = new PreferencesStore(storage);
    await store.update({ language: 'en', voiceEnabled: false, voiceSpeed: 2 });
    await store.resetPreferences();
    const prefs = store.getPreferences();
    assert.equal(prefs.language, 'fr');
    assert.equal(prefs.voiceEnabled, true);
    assert.equal(prefs.voiceSpeed, DEFAULT_VOICE_SPEED);
    assert.equal(await storage.getItem('keep-me'), '1');
  });

  it('persists dictationPace with medium default', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new PreferencesStore(storage);
    await store.ensureLoaded();
    assert.equal(store.getPreferences().dictationPace, 'medium');
    await store.update({ dictationPace: 'fast' });
    const again = new PreferencesStore(storage);
    await again.ensureLoaded();
    assert.equal(again.getPreferences().dictationPace, 'fast');
  });

  it('isHydrated becomes true after ensureLoaded', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new PreferencesStore(storage);
    assert.equal(store.isHydrated(), false);
    await store.ensureLoaded();
    assert.equal(store.isHydrated(), true);
  });

  it('persists chessInputMode and stockfishStrengthBandId', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new PreferencesStore(storage);
    await store.ensureLoaded();
    await store.update({
      chessInputMode: 'keypad',
      stockfishStrengthBandId: '1200-1400',
    });
    const again = new PreferencesStore(storage);
    await again.ensureLoaded();
    assert.equal(again.getPreferences().chessInputMode, 'keypad');
    assert.equal(again.getPreferences().stockfishStrengthBandId, '1200-1400');
  });

  it('defaults missing stockfishStrengthBandId to the classic default', () => {
    const merged = mergePreferencesDocument({
      version: 1,
      language: 'fr',
    });
    assert.ok(merged);
    assert.equal(merged!.stockfishStrengthBandId, '1600-1800');
  });

  it('persists the two PGN translation options after remount', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new PreferencesStore(storage);
    await store.ensureLoaded();
    assert.equal(store.getPreferences().translateExistingPgnComments, false);
    assert.equal(store.getPreferences().translateImportedPgnComments, false);

    await store.update({
      translateExistingPgnComments: true,
      translateImportedPgnComments: true,
    });
    const again = new PreferencesStore(storage);
    await again.ensureLoaded();
    assert.equal(again.getPreferences().translateExistingPgnComments, true);
    assert.equal(again.getPreferences().translateImportedPgnComments, true);
  });

  it('keeps a legacy auto-import translation flag and defaults missing options off', () => {
    const merged = mergePreferencesDocument({
      version: 1,
      language: 'fr',
      autoTranslateImportedPgnComments: true,
    });
    assert.ok(merged);
    assert.equal(merged!.translateExistingPgnComments, false);
    assert.equal(merged!.translateImportedPgnComments, true);
  });
});

describe('device language', () => {
  it('keeps a supported phone language and falls back to English', () => {
    assert.equal(appLanguageFromTag('fr-FR'), 'fr');
    assert.equal(appLanguageFromTag('en_US'), 'en');
    assert.equal(appLanguageFromTag('de-DE'), 'en');
    assert.equal(appLanguageFromTag(null), 'en');
  });

  it('applies the phone language only when nothing is stored yet', async () => {
    const storage = new MemoryKeyValueStorage();
    const first = new PreferencesStore(storage, { deviceLanguage: () => 'en' });
    await first.ensureLoaded();
    assert.equal(first.getPreferences().language, 'en');
    assert.equal(first.getPreferences().preferencesOrigin, 'device');
    assert.deepEqual(first.getPreferences().manualFields, []);

    await first.update({ language: 'fr', voiceEnabled: false });
    assert.equal(first.getPreferences().preferencesOrigin, 'device');
    assert.ok(first.getPreferences().manualFields?.includes('language'));
    assert.ok(first.getPreferences().manualFields?.includes('voiceEnabled'));

    const again = new PreferencesStore(storage, { deviceLanguage: () => 'en' });
    await again.ensureLoaded();
    assert.equal(again.getPreferences().language, 'fr');
    assert.equal(again.getPreferences().voiceEnabled, false);
  });

  it('does not replace a language already saved on the device', async () => {
    const storage = new MemoryKeyValueStorage();
    const saved = JSON.stringify({
      version: 1,
      language: 'fr',
      chessNotation: 'en',
      updatedAt: '2024-04-01T00:00:00.000Z',
    });
    await storage.setItem(StorageKeys.userPreferences.key, saved);
    const store = new PreferencesStore(storage, { deviceLanguage: () => 'en' });
    await store.ensureLoaded();
    assert.equal(store.getPreferences().language, 'fr');
    assert.equal(store.getPreferences().chessNotation, 'en');
    assert.equal(store.getPreferences().preferencesOrigin, undefined);
    assert.equal(
      await storage.getItem(StorageKeys.userPreferences.key),
      saved,
    );
  });
});
