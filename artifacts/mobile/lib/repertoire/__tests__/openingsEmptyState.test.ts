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

describe('openings hub empty vs populated', () => {
  const index = read('app/openings/index.tsx');

  it('shows OpeningEmptyState when folders.length === 0', () => {
    assert.match(index, /OpeningEmptyState/);
    assert.match(index, /empty/);
    assert.match(index, /<OpeningEmptyState/);
  });

  it('empty CTA opens PGN management', () => {
    assert.match(index, /\/openings\/manage/);
    assert.match(index, /openings-manage-pgn-btn/);
  });

  it('does not keep review-all / import / folder CRUD on the hub', () => {
    assert.doesNotMatch(index, /FolderListRow/);
    assert.doesNotMatch(index, /import-pgn-root-btn/);
    assert.doesNotMatch(index, /create-folder-btn/);
    assert.doesNotMatch(index, /review-all-btn/);
  });

  it('manage still uses the existing light-index import and create-folder workflow', () => {
    const manage = read('app/openings/manage.tsx');
    assert.match(manage, /openImport/);
    assert.match(manage, /openCreatePgn/);
    assert.match(manage, /openCreate/);
    assert.match(manage, /create-folder-btn/);
    assert.match(manage, /import-pgn-root-btn/);
    assert.match(manage, /\/openings\/import/);
  });
});

describe('openings manage import wiring', () => {
  const manage = read('app/openings/manage.tsx');
  const importScreen = read('app/openings/import.tsx');

  it('routes import to the shared panel and defaults to À classer', () => {
    assert.match(manage, /openImport/);
    assert.match(manage, /\/openings\/import/);
    assert.match(importScreen, /PgnImportPanel/);
    assert.match(importScreen, /allowFen=\{false\}/);
    assert.match(importScreen, /getUnfiledFolderId/);
    assert.match(importScreen, /MAX_OPENINGS_PGN_IMPORT_BATCH/);
    assert.doesNotMatch(manage, /folderNameFromPgnFilename/);
    assert.doesNotMatch(manage, /createFolderUnique/);
    assert.doesNotMatch(manage, /Non classées/);
    assert.doesNotMatch(manage, /ImportPgnModal/);
  });

  it('surfaces import errors without crashing (status / formError path)', () => {
    assert.match(manage, /setFormError/);
    assert.match(manage, /setStatusMsg/);
    assert.match(manage, /catch \(err\)/);
  });

  it('requires White or Black when creating a folder', () => {
    assert.match(manage, /createSide/);
    assert.match(manage, /openings\.sideRequired/);
    assert.match(manage, /RepertoireSidePicker/);
    assert.match(manage, /openings\.toClassify/);
    assert.match(manage, /openings\.chooseWhiteOrBlack/);
    assert.match(manage, /manage-folder-classify-/);
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
    assert.equal(translate('fr', 'openings.manageTitle'), 'Mes PGN d’ouverture');
    assert.equal(translate('en', 'openings.manageTitle'), 'My opening PGNs');
    assert.equal(translate('fr', 'openings.importOpeningPgn'), 'Importer un PGN d’ouverture');
    assert.equal(translate('en', 'openings.importOpeningPgn'), 'Import an opening PGN');
    assert.equal(translate('fr', 'openings.createOpeningPgn'), 'Créer un PGN d’ouverture');
    assert.equal(translate('en', 'openings.createOpeningPgn'), 'Create an opening PGN');
    assert.equal(translate('fr', 'openings.editOpeningPgn'), 'Éditer un PGN d’ouverture');
    assert.equal(translate('en', 'openings.editOpeningPgn'), 'Edit an opening PGN');
    assert.equal(translate('fr', 'openings.createFolderFab'), 'Dossier');
    assert.equal(translate('en', 'openings.createFolderFab'), 'Folder');
    assert.equal(translate('fr', 'openings.createFolderA11y'), 'Créer un nouveau dossier');
    assert.equal(translate('en', 'openings.createFolderA11y'), 'Create a new folder');
    assert.equal(translate('fr', 'openings.toClassify'), 'À classer');
    assert.equal(translate('en', 'openings.toClassify'), 'To sort');
    assert.equal(translate('fr', 'openings.chooseWhiteOrBlack'), 'Choisir Blancs ou Noirs');
    assert.equal(translate('en', 'openings.chooseWhiteOrBlack'), 'Choose White or Black');
    assert.equal(translate('fr', 'openings.sectionUnassigned'), 'À CLASSER');
    assert.equal(translate('en', 'openings.sectionUnassigned'), 'TO SORT');
  });

  it('does not hardcode empty-state French in OpeningEmptyState', () => {
    const src = read('components/openings/OpeningEmptyState.tsx');
    assert.doesNotMatch(src, /Tu n’as pas encore/);
    assert.doesNotMatch(src, /Créer un dossier/);
    assert.doesNotMatch(src, /Importer un PGN/);
  });
});
