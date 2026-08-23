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

  it('does not reference three-pawns or HubModeCard carousel', () => {
    assert.doesNotMatch(catalog, /three-pawns/);
    assert.doesNotMatch(catalog, /HubModeCard/);
  });
});
