import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { register } from 'node:module';
import React from 'react';
import { preferencesStore } from '../PreferencesStore.ts';
import { translate } from '../../i18n/messages.ts';
register('./settingsUiLoader.mjs', import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { create, act } = await import('react-test-renderer');
const { state } = await import('./settingsUiRuntime.ts');
const { default: Settings } = await import('../../../app/parametres.tsx');
let view: ReturnType<typeof create>;
beforeEach(async () => {
  await preferencesStore.resetPreferences();
  state.confirmation = null;
  state.user = null;
  state.platform = 'android';
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
});
function node(id: string) {
  return view.root.findByProps({ testID: id });
}
async function press(id: string) {
  await act(async () => {
    (node(id).props.onPress ?? node(id).props.onToggle)();
  });
}

describe('settings screen', () => {
  it('offers one language choice in FR/EN, keeps the general menu and confirms reset', async () => {
    for (const language of ['fr', 'en'] as const) {
      await act(async () => {
        await preferencesStore.update({ language });
        view = create(<Settings />);
      });
      assert.ok(node('general-menu'));
      const text = JSON.stringify(view.toJSON());
      for (const key of [
        'settings.languageNotation',
        'settings.boardDisplay',
        'settings.voiceDictation',
        'settings.defaultDifficulties',
        'settings.engineStrength',
        'settings.resetSection',
      ] as const)
        assert.ok(text.includes(translate(language, key)), key);
      assert.equal(
        view.root.findAllByProps({ testID: 'profil-notation-en' }).length,
        0,
      );
      assert.equal(
        view.root.findAllByProps({ testID: 'profil-dictation-lang-en' }).length,
        0,
      );
      assert.equal(
        view.root.findAllByProps({ testID: 'parametres-sync-wifi-only' })
          .length,
        0,
      );
      await act(async () => view.unmount());
    }
    await act(async () => {
      view = create(<Settings />);
    });
    await press('profil-lang-fr');
    assert.equal(preferencesStore.getPreferences().chessNotation, 'fr');
    assert.equal(preferencesStore.getPreferences().dictationLanguage, 'fr');
    await press('profil-lang-en');
    assert.equal(preferencesStore.getPreferences().chessNotation, 'en');
    await press('profil-pref-coordinates');
    assert.equal(preferencesStore.getPreferences().coordinatesEnabled, false);
    await press('profil-reset-prefs');
    assert.equal(preferencesStore.getPreferences().coordinatesEnabled, false);
    assert.equal(preferencesStore.getPreferences().language, 'en');
    await act(async () => {
      state.confirmation!();
    });
    assert.equal(preferencesStore.getPreferences().coordinatesEnabled, true);
    assert.equal(preferencesStore.getPreferences().language, 'fr');
    assert.equal(preferencesStore.getPreferences().syncOnWifiOnly, false);
  });

  it('persists discrete choices from touch, keyboard buttons and accessibility actions, keeping all/random', async () => {
    await act(async () => {
      view = create(<Settings />);
    });
    await press('profil-row-visual-difficulty');
    const track = () => node('profil-visual-difficulty-slider-track');
    await act(async () => {
      track().props.onValueChange(1.8);
    });
    const saved = preferencesStore.getPreferences().visualProblemDifficulty;
    assert.notEqual(saved, 'all');
    await press('profil-visual-difficulty-slider-increase');
    assert.notEqual(
      preferencesStore.getPreferences().visualProblemDifficulty,
      saved,
    );
    await act(async () => {
      track().props.onAccessibilityAction({
        nativeEvent: { actionName: 'decrement' },
      });
    });
    assert.equal(
      preferencesStore.getPreferences().visualProblemDifficulty,
      saved,
    );
    await act(async () => {
      track().props.onValueChange(-100);
    });
    assert.equal(
      node('profil-visual-difficulty-slider-decrease').props.disabled,
      true,
    );
    await act(async () => {
      track().props.onValueChange(100);
    });
    assert.equal(
      node('profil-visual-difficulty-slider-increase').props.disabled,
      true,
    );
    assert.ok(track().props.accessibilityValue.text);
    assert.equal(track().props.accessibilityRole, 'adjustable');
    const { PuzzleFilterChip } =
      await import('../../../components/puzzles/PuzzleFilterChip.tsx');
    await act(async () =>
      view.root.findByType(PuzzleFilterChip).props.onPress(),
    );
    assert.equal(
      preferencesStore.getPreferences().visualProblemDifficulty,
      'all',
    );
    await press('profil-difficulty-done');
    await press('profil-row-stockfish-strength');
    await act(async () => {
      node('profil-stockfish-strength-slider-track').props.onValueChange(2.2);
    });
    assert.equal(
      preferencesStore.getPreferences().stockfishStrengthBandId,
      '1000-1200',
    );
    state.platform = 'web';
    await act(async () => view.update(<Settings />));
    const engineTrack = () => node('profil-stockfish-strength-slider-track');
    let prevented = 0;
    const key = async (key: string) =>
      act(async () =>
        engineTrack().props.onKeyDown({
          key,
          preventDefault: () => {
            prevented++;
          },
        }),
      );
    await key('ArrowRight');
    assert.equal(
      preferencesStore.getPreferences().stockfishStrengthBandId,
      '1200-1400',
    );
    await key('Home');
    assert.equal(
      preferencesStore.getPreferences().stockfishStrengthBandId,
      'lt800',
    );
    await key('End');
    assert.equal(
      preferencesStore.getPreferences().stockfishStrengthBandId,
      'gt2200',
    );
    assert.equal(prevented, 3);
  });
});
