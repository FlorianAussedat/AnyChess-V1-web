/**
 * Smoke checks for the endgame-training rebuild wiring.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StorageKeys } from '../../storage/StorageKeys.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('endgame training rebuild smoke', () => {
  it('menu screen has two card keys', () => {
    const menu = read('app/puzzles/defends-nulle.tsx');
    assert.match(menu, /testID="endgame-card-new"/);
    assert.match(menu, /testID="endgame-card-try-again"/);
  });

  it('play screen has no Undo / Annuler for scored attempt', () => {
    const play = read('app/puzzles/defends-nulle-play.tsx');
    assert.doesNotMatch(play, /\bUndo\b/);
    assert.doesNotMatch(play, /\bAnnuler\b/);
  });

  it('hub card uses quiz.defendsNulle', () => {
    const hub = read('components/puzzles/PuzzleHubPhase.tsx');
    assert.match(hub, /t\('quiz\.defendsNulle'\)/);
  });

  it('FR messages for defendsNulle and page title', () => {
    const messages = read('lib/i18n/messages.ts');
    assert.match(messages, /'quiz\.defendsNulle':\s*'Défends la nulle !'/);
    assert.match(
      messages,
      /'quiz\.defendsNullePageTitle':\s*'Entraînement aux Finales'/,
    );
  });

  it('layout registers defends-nulle-play', () => {
    const layout = read('app/puzzles/_layout.tsx');
    assert.match(layout, /defends-nulle-play/);
  });

  it('storage key anychess.endgameTraining.v2', () => {
    assert.equal(StorageKeys.endgameTrainingV2.key, 'anychess.endgameTraining.v2');
  });

  it('runtime pool is empty pending realistic import', () => {
    const pool = read('lib/endgameTraining/data/pool.generated.ts');
    assert.match(pool, /ENDGAME_TRAINING_POOL: readonly EndgameTrainingPosition\[\] = \[\]/);
    assert.doesNotMatch(pool, /DD-001/);
  });
});
