/**
 * Lot 3 — Problèmes à l'aveugle: single Trait, camp announce, single board,
 * narration without duplicated side-to-move, ply announce after correct moves.
 */
import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preferencesStore } from '../../preferences/PreferencesStore.ts';
import { narratePosition } from '../PuzzlePositionNarrator.ts';
import { translate } from '../../i18n/messages.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

const START =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

before(async () => {
  await preferencesStore.ensureLoaded();
  await preferencesStore.update({ language: 'fr' });
});

describe('PuzzlePositionNarrator', () => {
  it('omits Trait by default so UI can show it once', () => {
    const text = narratePosition(START);
    assert.match(text, /Position des Blancs/);
    assert.match(text, /Position des Noirs/);
    assert.doesNotMatch(text, /Trait aux/);
  });

  it('can include side-to-move when explicitly requested', async () => {
    await preferencesStore.update({ language: 'fr' });
    const text = narratePosition(START, { includeSideToMove: true });
    assert.match(text, /Trait aux Blancs/);
  });
});

describe('blind puzzle UX contracts', () => {
  it('announces camp then queues position narration on blind start', () => {
    const ctx = read('contexts/PuzzleContext.tsx');
    assert.match(ctx, /puzzle\.youPlayWhite/);
    assert.match(ctx, /puzzle\.youPlayBlack/);
    assert.match(ctx, /announceBlindPosition\(snap\.startFen,\s*\{\s*flush:\s*false\s*\}\)/);
    assert.match(ctx, /puzzle\.plyAnnounce/);
    assert.match(ctx, /refreshBlindNarrationSilent\(sessionRef\.current\.getFen\(\)\)/);
  });

  it('shows youPlay in meta and a single Trait under narration', () => {
    const ui = read('components/puzzles/PuzzlePlayingPhase.tsx');
    assert.match(ui, /puzzle\.youPlayWhite/);
    assert.match(ui, /puzzle\.youPlayBlack/);
    assert.match(ui, /testID="puzzle-blind-side-to-move"/);
    assert.match(ui, /testID="puzzle-blind-ply-feedback"/);
    // Blind reveal board only while playing — never with solution board.
    assert.match(
      ui,
      /showBoard && submode === 'blind' && phase === 'playing'/,
    );
    assert.match(ui, /testID="puzzle-solution-board"/);
    assert.match(ui, /phase === 'solution-replay'/);
  });

  it('ships ply announce copy FR/EN', () => {
    assert.equal(
      translate('fr', 'puzzle.plyAnnounce', {
        user: 'Cf6',
        opponent: 'exf6',
      }),
      'Cf6 joué. L’adversaire joue exf6.',
    );
    assert.equal(
      translate('en', 'puzzle.plyAnnounce', {
        user: 'Nf6',
        opponent: 'exf6',
      }),
      'Nf6 played. Opponent plays exf6.',
    );
    assert.equal(translate('fr', 'puzzle.youPlayWhite'), 'Vous jouez les Blancs');
    assert.equal(translate('en', 'puzzle.youPlayBlack'), 'You play Black');
  });
});
