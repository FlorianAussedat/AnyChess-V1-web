/**
 * Openings library empty state — copy, CTA, and folder-first wiring contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '../../i18n/messages.ts';
import { folderNameFromPgnFilename } from '../folderNameFromPgnFilename.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('folderNameFromPgnFilename', () => {
  it('strips .pgn and keeps a usable folder name', () => {
    assert.equal(folderNameFromPgnFilename('London.pgn'), 'London');
    assert.equal(folderNameFromPgnFilename('caro-kann.PGN'), 'caro-kann');
    assert.equal(folderNameFromPgnFilename('  lines.pgn  '), 'lines');
  });
});

describe('OpeningEmptyState component', () => {
  it('renders explanatory copy keys and create-folder CTA', () => {
    const src = read('components/openings/OpeningEmptyState.tsx');
    assert.match(src, /openings\.emptyTitle/);
    assert.match(src, /openings\.emptyLead/);
    assert.match(src, /openings\.emptySources/);
    assert.match(src, /openings\.emptyPurpose/);
    assert.match(src, /openings\.createFolder/);
    assert.match(src, /onCreateFolder/);
    assert.match(src, /openings-empty-create-btn/);
    assert.match(src, /AppButton/);
    assert.doesNotMatch(src, /onImport/);
    assert.doesNotMatch(src, /openings\.importPgn/);
  });
});

describe('openings index empty vs populated', () => {
  const index = read('app/openings/index.tsx');

  it('shows OpeningEmptyState when folders.length === 0', () => {
    assert.match(index, /OpeningEmptyState/);
    assert.match(index, /folders\.length === 0/);
    assert.match(index, /<OpeningEmptyState onCreateFolder=/);
  });

  it('wires light-index import + mandatory folder pick (no auto unclassified)', () => {
    assert.match(index, /openImport/);
    assert.match(index, /importPgn/);
    assert.match(index, /pickPgnFile/);
    assert.match(index, /indexPgnGamesLight/);
    assert.match(index, /PgnGameSelectModal/);
    assert.match(index, /MAX_OPENINGS_PGN_IMPORT_BATCH/);
    assert.match(index, /FolderPickModal/);
    assert.match(index, /joinSelectedPgnSlices/);
    assert.doesNotMatch(index, /folderNameFromPgnFilename/);
    assert.doesNotMatch(index, /createFolderUnique/);
    assert.doesNotMatch(index, /Non classées/);
    assert.doesNotMatch(index, /ImportPgnModal/);
  });

  it('navigates into folder after create from empty state', () => {
    assert.match(index, /navigateAfterCreate/);
    assert.match(index, /router\.push\(`\/openings\/\$\{folder\.id\}/);
  });

  it('keeps the normal folder list when the library is not empty', () => {
    assert.match(index, /FolderListRow/);
    assert.match(index, /whiteFolders\.map\(renderFolderRow\)/);
    assert.match(index, /blackFolders\.map\(renderFolderRow\)/);
    assert.match(index, /create-folder-btn/);
    assert.match(index, /import-pgn-root-btn/);
  });

  it('surfaces import errors without crashing (status / formError path)', () => {
    assert.match(index, /setFormError/);
    assert.match(index, /setStatusMsg/);
    assert.match(index, /catch \(err\)/);
  });
});

describe('openings empty-state i18n', () => {
  it('provides FR / EN empty-state strings (folder-first)', () => {
    assert.match(translate('fr', 'openings.emptyTitle'), /pas encore de répertoire/i);
    assert.match(translate('en', 'openings.emptyTitle'), /don’t have a repertoire yet/i);
    assert.match(translate('fr', 'openings.emptyLead'), /dossier/i);
    assert.match(translate('en', 'openings.emptyLead'), /folder/i);
    assert.match(translate('fr', 'openings.emptySources'), /PGN/i);
    assert.match(translate('en', 'openings.emptySources'), /PGN/i);
    assert.match(translate('fr', 'openings.emptyPurpose'), /mémoriser/);
    assert.match(translate('en', 'openings.emptyPurpose'), /memorize/);
    assert.equal(translate('fr', 'openings.createFolder'), 'Créer un dossier');
    assert.equal(translate('en', 'openings.createFolder'), 'Create a folder');
    assert.equal(translate('fr', 'openings.importPgn'), 'Importer un PGN');
    assert.equal(translate('en', 'openings.importPgn'), 'Import a PGN');
  });

  it('does not hardcode empty-state French in OpeningEmptyState', () => {
    const src = read('components/openings/OpeningEmptyState.tsx');
    assert.doesNotMatch(src, /Tu n’as pas encore/);
    assert.doesNotMatch(src, /Créer un dossier/);
    assert.doesNotMatch(src, /Importer un PGN/);
  });
});
