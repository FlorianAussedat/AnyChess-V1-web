/**
 * Source contracts for the defend-draw screens.
 * These read the implementation. They do not render React Native or run Stockfish.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel: string): string {
  return readFileSync(`${root}/${rel}`, 'utf8');
}

describe('defend-draw menu and review UI', () => {
  it('shows three short menu entries and no try-again counter', () => {
    const menu = read('app/puzzles/defends-nulle.tsx');
    assert.match(menu, /quiz\.ddNewFinale/);
    assert.match(menu, /quiz\.ddReviewFinales/);
    assert.match(menu, /quiz\.ddHistory/);
    assert.match(menu, /defends-nulle-favorites/);
    assert.match(menu, /defends-nulle-history/);
    assert.doesNotMatch(menu, /Essaie encore/);
    assert.doesNotMatch(menu, /endgameTryAgain/);
    assert.doesNotMatch(menu, /tryAgainCount/);
  });

  it('hides the live gauge and curve, keeps one camp line, and drops the old actions', () => {
    const play = read('app/puzzles/defends-nulle-play.tsx');
    assert.match(play, /endgame-camp-banner/);
    assert.match(play, /quiz\.ddDefendWithWhite/);
    assert.match(play, /quiz\.ddDefendWithBlack/);
    assert.doesNotMatch(play, /youPlayWhite|youPlayBlack/);
    assert.doesNotMatch(play, /endgame-gauge-toggle|endgameHideGauge|EvalCurve|endgame-eval-curve/);
    assert.doesNotMatch(play, /endgame-analyse-position|endgame-add-try-again|endgame-back-menu/);
    assert.doesNotMatch(play, /TryAgainPromptModal/);
    assert.match(play, /DefendDrawReviewCard/);
    assert.match(play, /showResult && snap\.result && snap\.position/);
    assert.doesNotMatch(play, /EvalBalanceBar/);
    const review = read('components/exercise/DefendDrawReviewCard.tsx');
    assert.match(review, /endgame-review-gauge/);
    assert.match(review, /showReviewGauge/);
    assert.match(play, /DefendDrawStarButton/);
    assert.match(play, /presentAppDialog/);
    assert.match(play, /quiz\.ddUnstarTitle/);
    assert.match(play, /endgame-analyse-game/);
    assert.match(play, /endgame-retry/);
    assert.match(play, /endgame-finish-game/);
    assert.match(play, /defendsNulleDefendNext/);
    assert.match(play, /initialFen/);
    assert.equal((play.match(/defendsNulleReflecting/g) ?? []).length, 1);
    assert.match(play, /isOpponentThinking=\{thinking && engineReady\}/);
    assert.doesNotMatch(play, /ActivityIndicator[\s\S]{0,180}defendsNulleReflecting/);
    assert.doesNotMatch(play, /defendsNulleReflecting[\s\S]{0,180}ActivityIndicator/);
  });

  it('keeps the upper thinking status and removes the lower spinner in theoretical endgames', () => {
    const play = read('app/puzzles/finales-theoriques-play.tsx');
    assert.equal((play.match(/defendsNulleReflecting/g) ?? []).length, 1);
    assert.match(play, /isOpponentThinking=\{thinking && engineReady\}/);
    assert.doesNotMatch(play, /ActivityIndicator[\s\S]{0,180}defendsNulleReflecting/);
  });

  it('records only a finished attempt id and restores an active session without starting over', () => {
    const play = read('app/puzzles/defends-nulle-play.tsx');
    assert.match(play, /recordedRef/);
    assert.match(play, /sessionRef\.current\.restore/);
    assert.match(play, /presentStoredReview/);
    assert.match(play, /outcome !== 'abandoned'/);
    assert.match(play, /abandon\(\)/);
    const favorites = read('app/puzzles/defends-nulle-favorites.tsx');
    const history = read('app/puzzles/defends-nulle-history.tsx');
    assert.match(favorites, /quiz\.ddFavoritesEmpty/);
    assert.match(history, /quiz\.ddHistoryEmpty/);
    assert.match(history, /DefendDrawStarButton/);
    assert.match(favorites, /presentAppDialog/);
    assert.doesNotMatch(favorites, /Essaie encore/);
    assert.doesNotMatch(history, /Essaie encore/);
  });
});
