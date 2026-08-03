import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_MODE_CARD_META } from '../mainModeCards.ts';
import { DesignTokens } from '../../../constants/designTokens.ts';

describe('main mode cards catalog', () => {
  it('exposes exactly the six existing modes with stable routes', () => {
    assert.deepEqual(
      MAIN_MODE_CARD_META.map((m) => m.id),
      ['classic', 'openings', 'blind', 'puzzles', 'visualisation', 'quiz-ouverture'],
    );
    assert.deepEqual(
      MAIN_MODE_CARD_META.map((m) => String(m.route)),
      ['/classic', '/openings', '/blind', '/puzzles', '/visualisation', '/quiz-ouverture'],
    );
  });

  it('keeps titles and descriptions non-empty for the home ModeCard', () => {
    for (const mode of MAIN_MODE_CARD_META) {
      assert.ok(mode.title.trim().length > 0, mode.id);
      assert.ok(mode.description.trim().length > 0, mode.id);
      assert.ok(mode.iconName.length > 0, mode.id);
      assert.ok(mode.requiredMascotAsset.endsWith('.png'), mode.id);
    }
  });
});

describe('design tokens', () => {
  it('reserves a sensible bottom-nav content height for Android thumbs', () => {
    assert.ok(DesignTokens.bottomNavContentHeight >= 52);
    assert.ok(DesignTokens.minTouchTarget >= 44);
    assert.ok(DesignTokens.radius.card >= 16);
  });
});
