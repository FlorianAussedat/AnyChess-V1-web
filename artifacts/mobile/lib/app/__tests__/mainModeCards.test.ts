import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAIN_MODE_CARD_META } from '../mainModeCards.ts';
import { DesignTokens } from '../../../constants/designTokens.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

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

  it('uses the French home labels and short action-focused descriptions', () => {
    const byId = Object.fromEntries(MAIN_MODE_CARD_META.map((m) => [m.id, m]));
    assert.equal(byId.classic?.title, 'Partie classique');
    assert.equal(
      byId.classic?.description,
      'Joue aux échecs sur l’échiquier ou à la voix.',
    );
    assert.equal(byId.openings?.title, 'Apprends tes ouvertures');
    assert.equal(
      byId.openings?.description,
      'Apprends tes ouvertures et entraîne-toi à les rejouer.',
    );
    assert.equal(byId.blind?.title, 'Mémorisation');
    assert.equal(
      byId.blind?.description,
      'Retiens des suites de coups en les écoutant ou en les regardant.',
    );
    assert.equal(byId.puzzles?.title, 'Entraînement tactique');
    assert.equal(
      byId.puzzles?.description,
      'Résous des problèmes et entraîne tes finales.',
    );
    assert.equal(byId.visualisation?.title, 'Vision de l’échiquier');
    assert.equal(
      byId.visualisation?.description,
      'Suis les coups mentalement et repère-les sur l’échiquier.',
    );
    assert.equal(byId['quiz-ouverture']?.title, 'Culture générale');
    assert.equal(
      byId['quiz-ouverture']?.description,
      'Reconnais les ouvertures et teste tes connaissances.',
    );
    assert.equal(byId.parties?.title, 'Parties');
    assert.equal(
      byId.parties?.description,
      'Retrouve, rejoue et analyse tes parties.',
    );
    assert.equal(byId.parties?.requiredMascotAsset, 'mascot-player-knight-dj.png');
  });
});

describe('design tokens', () => {
  it('reserves a sensible bottom-nav content height for Android thumbs', () => {
    assert.ok(DesignTokens.bottomNavContentHeight >= 52);
    assert.ok(DesignTokens.minTouchTarget >= 44);
    assert.ok(DesignTokens.radius.card >= 16);
  });

  it('lets ModeCards grow from a readable minimum with a reserved mascot slot', () => {
    assert.ok(DesignTokens.modeCardMinHeight >= 140);
    assert.ok(DesignTokens.modeCardMinHeight <= 170);
    assert.ok(DesignTokens.modeIllustrationWidth >= 128);
    // Accueil viewport is ~28–32px of visible art (padding cropped via layout).
    assert.ok(DesignTokens.bottomNavHomeIconHeight >= 28);
    assert.ok(DesignTokens.bottomNavHomeIconHeight <= 36);
  });
});

describe('ModeCard layout', () => {
  it('does not truncate the menu explanation with numberOfLines', () => {
    const src = readFileSync(join(mobileRoot, 'components/home/ModeCard.tsx'), 'utf8');
    assert.doesNotMatch(src, /numberOfLines/);
    assert.match(src, /styles\.description/);
    assert.match(src, /textCol/);
    assert.match(src, /illustrationSlot/);
    assert.match(src, /flexDirection: 'row'/);
    assert.doesNotMatch(src, /width: '48%'/);
  });
});
