import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_MODE_CARD_META } from '../mainModeCards.ts';
import { DesignTokens } from '../../../constants/designTokens.ts';

describe('main mode cards catalog', () => {
  it('exposes exactly the six existing modes with stable routes', () => {
    assert.deepEqual(
      MAIN_MODE_CARD_META.map((m) => m.id),
      [
        'classic',
        'openings',
        'blind',
        'puzzles',
        'visualisation',
        'quiz-ouverture',
        'parties',
      ],
    );
    assert.deepEqual(
      MAIN_MODE_CARD_META.map((m) => String(m.route)),
      [
        '/classic',
        '/openings',
        '/blind',
        '/puzzles',
        '/visualisation',
        '/quiz-ouverture',
        '/parties',
      ],
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

  it('uses the 0.0.4.1 French home labels', () => {
    const byId = Object.fromEntries(MAIN_MODE_CARD_META.map((m) => [m.id, m]));
    assert.equal(byId.classic?.title, 'Partie classique');
    assert.match(byId.classic?.description ?? '', /voix|échiquier/i);
    assert.equal(byId.openings?.title, 'Apprends tes ouvertures');
    assert.equal(byId.blind?.title, 'Mémorisation');
    assert.equal(byId.puzzles?.title, 'Entraînement tactique');
    assert.equal(byId.visualisation?.title, 'Vision de l’échiquier');
    assert.equal(byId['quiz-ouverture']?.title, 'Culture générale');
  });
});

describe('design tokens', () => {
  it('reserves a sensible bottom-nav content height for Android thumbs', () => {
    assert.ok(DesignTokens.bottomNavContentHeight >= 52);
    assert.ok(DesignTokens.minTouchTarget >= 44);
    assert.ok(DesignTokens.radius.card >= 16);
  });

  it('targets denser ModeCards with larger mascot slots', () => {
    assert.ok(DesignTokens.modeCardHeight >= 150);
    assert.ok(DesignTokens.modeCardHeight <= 170);
    assert.ok(DesignTokens.modeIllustrationWidth >= 128);
    // Accueil viewport is ~28–32px of visible art (padding cropped via layout).
    assert.ok(DesignTokens.bottomNavHomeIconHeight >= 28);
    assert.ok(DesignTokens.bottomNavHomeIconHeight <= 36);
  });
});
