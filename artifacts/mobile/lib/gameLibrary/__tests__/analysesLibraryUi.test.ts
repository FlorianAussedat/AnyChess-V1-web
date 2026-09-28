/**
 * Analyses de parties UI + shared import contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '../../i18n/messages.ts';
import { DEFAULT_ANALYSIS_PROFILE, ANALYSIS_PROFILES } from '../../analysis/profiles.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('Analyses de parties copy', () => {
  it('renames the user-facing library title', () => {
    assert.equal(translate('fr', 'parties.title'), 'Analyses de parties');
    assert.equal(translate('fr', 'parties.importPgnFen'), 'Importer un PGN / FEN');
    assert.equal(
      translate('fr', 'parties.startFromInitial'),
      'Analyse depuis la position de départ',
    );
    assert.equal(translate('fr', 'parties.workspace'), 'Analyse de partie');
    assert.equal(translate('fr', 'parties.unfiledFolder'), 'À classer');
    assert.doesNotMatch(translate('fr', 'parties.title'), /^Parties$/);
  });
});

describe('Analyses de parties library screen', () => {
  const src = read('app/parties/index.tsx');

  it('renders the new primary actions and FAB, without Nouvelle partie / analyse', () => {
    assert.match(src, /parties-library/);
    assert.match(src, /parties-import/);
    assert.match(src, /parties-start-initial/);
    assert.match(src, /parties-new-folder/);
    assert.match(src, /LibraryActionRow/);
    assert.match(src, /LibraryFolderFab/);
    assert.match(src, /parties\.importPgnFen/);
    assert.match(src, /parties\.startFromInitial/);
    assert.doesNotMatch(src, /parties-open-workspace/);
    assert.doesNotMatch(src, /Nouvelle partie/);
  });

  it('keeps À classer locked', () => {
    assert.match(src, /isUnfiledGameFolder/);
    assert.match(src, /parties-folder-locked-unfiled/);
    assert.match(src, /lock-closed-outline/);
  });
});

describe('shared PGN import panel', () => {
  const panel = read('components/library/PgnImportPanel.tsx');
  const partiesImport = read('app/parties/import.tsx');
  const openingsImport = read('app/openings/import.tsx');

  it('reuses pickPgnFiles + light index and optional FEN', () => {
    assert.match(panel, /pgn-import-panel/);
    assert.match(panel, /pickPgnFiles/);
    assert.match(panel, /preparePgnSource/);
    assert.match(panel, /PgnGameSelectModal/);
    assert.match(panel, /allowFen/);
    assert.match(panel, /validateAnalysisFen/);
    assert.match(panel, /pgn-import-mode-/);
    assert.match(panel, /pgn-import-load/);
  });

  it('analyses import allows FEN and parks a draft without saving', () => {
    assert.match(partiesImport, /allowFen/);
    assert.match(partiesImport, /setParkedAnalyzerDraft/);
    assert.doesNotMatch(partiesImport, /importPgnText/);
    assert.match(partiesImport, /parseReaderPgn/);
  });

  it('openings import has no FEN source and saves to À classer', () => {
    assert.match(openingsImport, /allowFen=\{false\}/);
    assert.match(openingsImport, /getUnfiledFolderId/);
    assert.match(openingsImport, /PgnImportPanel/);
    assert.doesNotMatch(openingsImport, /pgn-import-fen-input/);
  });
});

describe('start-from-initial analyzer', () => {
  const analyzer = read('app/parties/analyzer.tsx');

  it('opens a blank board, saves only on demand, defaults to Rapide', () => {
    assert.match(analyzer, /emptyReaderGame/);
    assert.match(analyzer, /blank/);
    assert.match(analyzer, /takeParkedAnalyzerDraft/);
    assert.match(analyzer, /saveReaderGameToLibrary/);
    assert.match(analyzer, /anyliseur-save/);
    assert.match(analyzer, /profileId=\{analysis\?\.profileId \?\? 'fast'\}/);
    assert.equal(DEFAULT_ANALYSIS_PROFILE, 'fast');
    assert.equal(ANALYSIS_PROFILES.fast.movetimeMs, 250);
    assert.equal(ANALYSIS_PROFILES.fast.depth, 12);
  });
});

describe('openings system folder guards', () => {
  it('protects À classer from rename, delete and side changes', () => {
    const src = read('lib/repertoire/RepertoireService.ts');
    assert.match(src, /isUnfiledOpeningFolder/);
    assert.match(src, /errors\.systemFolderProtected/);
    assert.match(src, /ensureUnfiledFolder/);
    assert.match(src, /getUnfiledFolderId/);
  });
});
