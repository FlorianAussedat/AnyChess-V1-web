import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { register } from 'node:module';
import React from 'react';
import { preferencesStore } from '../PreferencesStore.ts';
import { PuzzleSession } from '../../puzzles/PuzzleSession.ts';
register('./settingsUiLoader.mjs', import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { create, act } = await import('react-test-renderer');
const { state } = await import('./settingsUiRuntime.ts');
const { GameProvider, useGame } =
  await import('../../../contexts/GameContext.tsx');
const { PuzzleProvider, usePuzzle } =
  await import('../../../contexts/PuzzleContext.tsx');
const { OpeningGameProvider, useOpeningGame } =
  await import('../../../contexts/OpeningGameContext.tsx');
beforeEach(async () => {
  await preferencesStore.update({
    stockfishStrengthBandId: '800-1000',
    visualProblemDifficulty: '600-799',
    blindProblemDifficulty: 'all',
  });
  state.appliedStrengths.length = 0;
});

describe('activity defaults and session overrides', () => {
  it('seeds Classic, changes its session only, and restores a saved band and moves', async () => {
    let game!: ReturnType<typeof useGame>;
    function Probe() {
      game = useGame();
      return null;
    }
    let view!: ReturnType<typeof create>;
    await act(async () => {
      view = create(
        <GameProvider>
          <Probe />
        </GameProvider>,
      );
    });
    assert.equal(game.strengthBandId, '800-1000');
    await act(async () => {
      game.setStrengthBandId('1200-1400');
    });
    assert.equal(game.strengthBandId, '1200-1400');
    assert.equal(
      preferencesStore.getPreferences().stockfishStrengthBandId,
      '800-1000',
    );
    const saved = {
      ...game.exportPlaySnapshot(),
      history: ['Nf3', 'Nf6'],
      strengthBandId: '1800-2000',
      playerColor: 'w' as const,
    };
    await act(async () => {
      await preferencesStore.update({ stockfishStrengthBandId: 'gt2200' });
      game.hydratePlaySnapshot(saved);
    });
    assert.equal(game.strengthBandId, '1800-2000');
    assert.deepEqual(game.history, ['Nf3', 'Nf6']);
    assert.equal(game.exportPlaySnapshot().strengthBandId, '1800-2000');
    assert.equal(
      preferencesStore.getPreferences().stockfishStrengthBandId,
      'gt2200',
    );
    // The already-created engine must also receive the restored strength.
    const restoredStrength = state.appliedStrengths.at(-1) as { elo: number };
    assert.ok(restoredStrength.elo >= 1860 && restoredStrength.elo <= 1940);
    await act(async () => view.unmount());
    await act(async () => {
      view = create(
        <GameProvider>
          <Probe />
        </GameProvider>,
      );
    });
    assert.equal(game.strengthBandId, 'gt2200');
    await act(async () => view.unmount());
  });

  it('seeds visual/blind puzzle defaults, retains random/all and restores the saved puzzle', async () => {
    let puzzle!: ReturnType<typeof usePuzzle>;
    function Probe() {
      puzzle = usePuzzle();
      return null;
    }
    let view!: ReturnType<typeof create>;
    await act(async () => {
      view = create(
        <PuzzleProvider>
          <Probe />
        </PuzzleProvider>,
      );
    });
    await act(async () => puzzle.selectSubmode('visual'));
    assert.equal(puzzle.ratingBandId, '600-799');
    await act(async () => puzzle.setRatingBand('1200-1399'));
    assert.equal(
      preferencesStore.getPreferences().visualProblemDifficulty,
      '600-799',
    );
    await act(async () => puzzle.selectSubmode('blind'));
    assert.equal(puzzle.ratingBandId, 'all');
    const session = new PuzzleSession();
    session.load({
      id: 'saved-puzzle',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      moves: ['f1b5', 'a7a6', 'b5a4'],
      rating: 1700,
      popularity: 90,
      themes: ['fork'],
    });
    const payload = {
      session: session.snapshot(),
      submode: 'visual',
      ratingBandId: '1600-1799',
      pieceCountBandId: 'all',
    };
    await act(async () =>
      state.persisted.get('puzzles-tactical').apply(payload),
    );
    assert.equal(puzzle.ratingBandId, '1600-1799');
    assert.equal(puzzle.puzzle?.id, 'saved-puzzle');
    assert.equal(puzzle.currentFen, payload.session.fen);
    assert.equal(puzzle.phase, 'playing');
    assert.equal(
      preferencesStore.getPreferences().blindProblemDifficulty,
      'all',
    );
    const captured = state.persisted.get('puzzles-tactical').capture();
    assert.equal(captured.ratingBandId, '1600-1799');
    await act(async () => view.unmount());
  });

  it('seeds opening continuation from preferences or an explicit saved route band without writing defaults', async () => {
    let opening!: ReturnType<typeof useOpeningGame>;
    function Probe() {
      opening = useOpeningGame();
      return null;
    }
    let view!: ReturnType<typeof create>;
    await act(async () => {
      view = create(
        <OpeningGameProvider repertoire={null} repertoireName="fixture">
          <Probe />
        </OpeningGameProvider>,
      );
    });
    assert.equal(opening.strengthBandId, '800-1000');
    await act(async () => opening.setStrengthBandId('1400-1600'));
    assert.equal(opening.strengthBandId, '1400-1600');
    assert.equal(
      preferencesStore.getPreferences().stockfishStrengthBandId,
      '800-1000',
    );
    await act(async () => view.unmount());
    await act(async () => {
      view = create(
        <OpeningGameProvider
          repertoire={null}
          repertoireName="fixture"
          strengthBandId="1800-2000"
        >
          <Probe />
        </OpeningGameProvider>,
      );
    });
    assert.equal(opening.strengthBandId, '1800-2000');
    await act(async () => view.unmount());
  });
});
