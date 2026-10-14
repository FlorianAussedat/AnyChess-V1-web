/**
 * Catalog UI contract — carousel / list / explanation wiring.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('theoretical catalog UI', () => {
  const catalog = read('app/puzzles/finales-theoriques.tsx');

  it('uses horizontal FlatList carousel with snap', () => {
    assert.match(catalog, /snapToInterval/);
    assert.match(catalog, /decelerationRate="fast"/);
    assert.match(catalog, /getItemLayout/);
    assert.match(catalog, /theoretical-theme-carousel/);
  });

  it('counts attempts and wins even when the average is empty', () => {
    const scoreLine = read('lib/theoreticalEndgame/ui/TheoreticalThemeScoreLine.tsx');
    assert.match(catalog, /TheoreticalThemeScoreLine/);
    assert.match(catalog, /backfillUngradedWins/);
    assert.match(scoreLine, /theoreticalAttemptWins/);
    assert.match(scoreLine, /quiz.theoreticalScorePending/);
    assert.match(scoreLine, /theoretical-theme-recalculate-/);
    assert.match(scoreLine, /quiz.theoreticalAverage/);
    assert.doesNotMatch(scoreLine, /theoreticalEstimatedScore/);
    assert.doesNotMatch(catalog, /theoreticalLegacyBadge/);
    assert.match(catalog, /TheoreticalScoreReset/);
    assert.match(catalog, /confirmAction|TheoreticalScoreReset/);
  });

  it('shows diagram, score, and explanation without launching from explain link', () => {
    assert.match(catalog, /TheoreticalMiniDiagram/);
    assert.match(catalog, /theoretical-theme-explain-/);
    assert.match(catalog, /TheoreticalExplanationOverlay/);
    assert.match(catalog, /setExplanationThemeId/);
  });

  it('keeps list mode and persists view preference', () => {
    assert.match(catalog, /theoretical-view-toggle/);
    assert.match(catalog, /setCatalogView/);
    assert.match(catalog, /theoretical-theme-list/);
  });

  it('list mode is not a vertical FlatList inside ChessScreenScaffold', () => {
    assert.match(catalog, /<View testID="theoretical-theme-list"/);
    const listSlice = catalog.slice(catalog.indexOf('theoretical-theme-list'));
    assert.doesNotMatch(listSlice.slice(0, 400), /FlatList/);
  });

  it('does not reference three-pawns or HubModeCard carousel', () => {
    assert.doesNotMatch(catalog, /three-pawns/);
    assert.doesNotMatch(catalog, /HubModeCard/);
  });
});
