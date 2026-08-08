/**
 * Phase 2 i18n / settings / notation independence checks.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { PreferencesStore } from '../../preferences/PreferencesStore.ts';
import { translate } from '../messages.ts';
import { tMsg } from '../tMsg.ts';
import { formatSanForDisplay } from '../../chess/notation.ts';
import { preferencesStore } from '../../preferences/PreferencesStore.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('i18n dictionaries', () => {
  it('Profile preference labels differ FR vs EN', () => {
    assert.equal(translate('fr', 'profil.language'), "Langue de l'application");
    assert.equal(translate('en', 'profil.language'), 'App language');
    assert.equal(translate('fr', 'profil.notation'), 'Notation des échecs');
    assert.equal(translate('en', 'profil.notation'), 'Chess notation');
    assert.equal(translate('fr', 'profil.notationFr'), 'Française');
    assert.equal(translate('en', 'profil.notationFr'), 'French');
    assert.equal(translate('fr', 'profil.notationEn'), 'Anglaise / Internationale');
    assert.equal(translate('en', 'profil.notationEn'), 'English / International');
  });

  it('reset confirmation copy clarifies scope', () => {
    assert.match(translate('fr', 'profil.resetPrefsBody'), /profil/i);
    assert.match(translate('en', 'profil.resetPrefsBody'), /profile/i);
    assert.match(translate('fr', 'profil.resetRecordsBody'), /records/);
    assert.match(translate('en', 'profil.resetRecordsBody'), /records/);
    assert.match(translate('fr', 'profil.resetRecordsBody'), /conservés/);
    assert.match(translate('en', 'profil.resetRecordsBody'), /kept/);
  });

  it('interpolates params', () => {
    assert.equal(
      translate('en', 'puzzle.nextMove', { san: 'Nf3' }),
      'Next move: Nf3',
    );
    assert.equal(
      translate('fr', 'blind.recognized', { san: 'Cf3' }),
      'Reconnu : Cf3',
    );
  });
});

describe('language vs chessNotation independence', () => {
  it('formatter ignores app language — only chessNotation matters', () => {
    // FR UI + EN notation
    assert.equal(formatSanForDisplay('Nf3', 'en'), 'Nf3');
    // EN UI + FR notation
    assert.equal(formatSanForDisplay('Nf3', 'fr'), 'Cf3');
  });

  it('preferences can mix language=en with chessNotation=fr', async () => {
    const store = new PreferencesStore(new MemoryKeyValueStorage());
    await store.ensureLoaded();
    await store.update({ language: 'en', chessNotation: 'fr' });
    const p = store.getPreferences();
    assert.equal(p.language, 'en');
    assert.equal(p.chessNotation, 'fr');
    assert.equal(translate(p.language, 'game.yourTurn'), 'Your move.');
    assert.equal(formatSanForDisplay('Qxd8+', p.chessNotation), 'Dxd8+');
  });
});

describe('tMsg follows PreferencesStore language', () => {
  beforeEach(async () => {
    await preferencesStore.ensureLoaded();
    await preferencesStore.update({ language: 'fr' });
  });

  it('returns French then English after update', async () => {
    assert.equal(tMsg('game.yourTurn'), 'À toi de jouer.');
    await preferencesStore.update({ language: 'en' });
    assert.equal(tMsg('game.yourTurn'), 'Your move.');
    await preferencesStore.update({ language: 'fr' });
  });
});

describe('SpeechService rate ownership', () => {
  it('default rate uses preference; per-call override is not sticky', () => {
    const speech = read('services/SpeechService.ts');
    assert.match(speech, /resolveRate/);
    assert.match(speech, /voiceSpeedToRate\(preferencesStore\.getPreferences\(\)\.voiceSpeed\)/);
    assert.doesNotMatch(speech, /this\.currentRate\s*=/);
    assert.match(speech, /When omitted, uses voiceSpeedToRate/);
  });
});

describe('language preference persistence', () => {
  it('survives store reload', async () => {
    const kv = new MemoryKeyValueStorage();
    const a = new PreferencesStore(kv);
    await a.ensureLoaded();
    await a.update({ language: 'en', chessNotation: 'fr' });

    const b = new PreferencesStore(kv);
    await b.ensureLoaded();
    assert.equal(b.getPreferences().language, 'en');
    assert.equal(b.getPreferences().chessNotation, 'fr');
  });
});
