/**
 * Local ProfileStore + Profil hub contracts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { ProfileStore } from '../ProfileStore.ts';
import { PLAYER_ELO_RANGES } from '../playerEloRanges.ts';
import { emptyUserProfile } from '../types.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('ProfileStore', () => {
  it('starts empty and persists username across new store instances', async () => {
    const storage = new MemoryKeyValueStorage();
    const a = new ProfileStore(storage);
    const empty = await a.ensureLoaded();
    assert.equal(empty.username, null);
    assert.equal(empty.rapidRangeId, null);
    assert.ok(empty.id.startsWith('local_'));

    await a.update({ username: '  Alice  ' });
    const b = new ProfileStore(storage);
    const restored = await b.ensureLoaded();
    assert.equal(restored.username, 'Alice');
    assert.equal(restored.id, empty.id);
  });

  it('keeps Rapid / Blitz / Bullet ranges independent', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new ProfileStore(storage);
    await store.update({
      rapidRangeId: '1600-1799',
      blitzRangeId: '1200-1399',
      bulletRangeId: '800-999',
    });
    const again = new ProfileStore(storage);
    const p = await again.ensureLoaded();
    assert.equal(p.rapidRangeId, '1600-1799');
    assert.equal(p.blitzRangeId, '1200-1399');
    assert.equal(p.bulletRangeId, '800-999');
  });

  it('persists chessYears', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new ProfileStore(storage);
    await store.update({ chessYears: 7 });
    const again = new ProfileStore(storage);
    assert.equal((await again.ensureLoaded()).chessYears, 7);
  });

  it('writes JSON under StorageKeys.userProfile only', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new ProfileStore(storage);
    await store.update({ username: 'Bob' });
    const raw = await storage.getItem(StorageKeys.userProfile.key);
    assert.ok(raw);
    const parsed = JSON.parse(raw!) as ReturnType<typeof emptyUserProfile>;
    assert.equal(parsed.version, 1);
    assert.equal(parsed.username, 'Bob');
    assert.ok(typeof parsed.updatedAt === 'string');
  });
});

describe('player Elo ranges', () => {
  it('includes unrated and puzzle-aligned bands', () => {
    assert.ok(PLAYER_ELO_RANGES.some((r) => r.id === 'unrated'));
    assert.ok(PLAYER_ELO_RANGES.some((r) => r.id === '600-799'));
    assert.ok(PLAYER_ELO_RANGES.some((r) => r.id === '2200+'));
  });
});

describe('Utilisateur / Paramètres screen scope', () => {
  it('splits identity and preferences without inventing accounts', () => {
    const utilisateur = readFileSync(
      join(here, '../../../app/utilisateur.tsx'),
      'utf8',
    );
    const parametres = readFileSync(
      join(here, '../../../app/parametres.tsx'),
      'utf8',
    );
    const profil = readFileSync(join(here, '../../../app/profil.tsx'), 'utf8');

    assert.match(profil, /Redirect/);
    assert.match(profil, /\/utilisateur/);

    assert.match(utilisateur, /utilisateur-screen/);
    assert.match(utilisateur, /profil-row-username/);
    assert.match(utilisateur, /profil-row-repertoires/);
    assert.match(utilisateur, /profil-row-records/);
    assert.match(utilisateur, /profil\.saveTitle/);
    assert.match(utilisateur, /profil-reset-records/);
    assert.doesNotMatch(utilisateur, /profil-row-language|profil-pref-voice|voiceSpeed/);
    assert.doesNotMatch(utilisateur, /Supabase|Firebase|OAuth|mot de passe|signup/i);
    assert.doesNotMatch(utilisateur, /localStorage|AsyncStorage/);

    assert.match(parametres, /parametres-screen/);
    assert.match(parametres, /ScreenHeader/);
    assert.match(parametres, /parametres-back/);
    assert.match(parametres, /router\.back\(\)/);
    assert.match(parametres, /profil-row-language/);
    assert.match(parametres, /profil-row-notation/);
    assert.match(parametres, /profil-pref-voice/);
    assert.match(parametres, /profil-pref-coordinates/);
    assert.match(parametres, /parametres-pace-/);
    assert.match(parametres, /dictationPace/);
    assert.match(parametres, /profil-row-visual-difficulty/);
    assert.match(parametres, /profil-row-blind-difficulty/);
    assert.match(parametres, /visualProblemDifficulty|blindProblemDifficulty/);
    assert.match(parametres, /usePreferences/);
    assert.match(parametres, /profil-reset-prefs/);
    assert.doesNotMatch(parametres, /profil-row-voice-speed|DiscreteSlider|voiceSpeed/);
    assert.doesNotMatch(parametres, /Supabase|Firebase|OAuth|mot de passe|signup/i);
  });
});
