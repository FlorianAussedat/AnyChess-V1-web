/**
 * Default voice speed preference — persisted via KeyValueStorage.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { VoiceSpeedSettings } from '../VoiceSpeedSettings.ts';
import { DEFAULT_VOICE_SPEED } from '../../continueLine/voiceSpeed.ts';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('VoiceSpeedSettings', () => {
  it('defaults to 5 and persists across instances', async () => {
    const storage = new MemoryKeyValueStorage();
    const a = new VoiceSpeedSettings(storage);
    await a.ensureLoaded();
    assert.equal(a.getDefaultSpeed(), DEFAULT_VOICE_SPEED);

    await a.setDefaultSpeed(8);
    const b = new VoiceSpeedSettings(storage);
    await b.ensureLoaded();
    assert.equal(b.getDefaultSpeed(), 8);
    assert.equal(await storage.getItem(StorageKeys.defaultVoiceSpeed.key), '8');
  });

  it('clamps to 1–10', async () => {
    const storage = new MemoryKeyValueStorage();
    const s = new VoiceSpeedSettings(storage);
    assert.equal(await s.setDefaultSpeed(99), 10);
    assert.equal(await s.setDefaultSpeed(0), 1);
  });
});

describe('preference key hygiene', () => {
  it('does not duplicate voice/coords keys in ProfileStore', () => {
    const profileStoreSrc = readFileSync(
      join(here, '../../profile/ProfileStore.ts'),
      'utf8',
    );
    assert.doesNotMatch(profileStoreSrc, /voiceEnabled|boardCoordinatesVisible/);
    assert.match(
      readFileSync(join(here, '../PreferencesStore.ts'), 'utf8'),
      /StorageKeys\.userPreferences/,
    );
    assert.match(
      readFileSync(join(here, '../../../services/AudioSettings.ts'), 'utf8'),
      /preferencesStore/,
    );
    assert.match(
      readFileSync(join(here, '../../../services/BoardCoordinatesSettings.ts'), 'utf8'),
      /preferencesStore/,
    );
  });
});
