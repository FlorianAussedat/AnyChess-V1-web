/**
 * Openings library empty state — copy, CTA, and import wiring contracts.
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
  it('renders explanatory copy keys and import CTA', () => {
    const src = read('components/openings/OpeningEmptyState.tsx');
    assert.match(src, /openings\.emptyTitle/);
    assert.match(src, /openings\.emptyLead/);
    assert.match(src, /openings\.emptySources/);
    assert.match(src, /openings\.emptyPurpose/);
    assert.match(src, /openings\.importPgn/);
    assert.match(src, /onImport/);
    assert.match(src, /openings-empty-import-btn/);
    assert.match(src, /AppButton/);
  });
});

describe('openings index empty vs populated', () => {
  const index = read('app/openings/index.tsx');

  it('shows OpeningEmptyState when folders.length === 0', () => {
    assert.match(index, /OpeningEmptyState/);
    assert.match(index, /folders\.length === 0/);
    assert.match(index, /<OpeningEmptyState onImport=\{openImport\}/);
  });

  it('wires ImportPgnModal via the same openImport / submitImport flow', () => {
    assert.match(index, /ImportPgnModal/);
    assert.match(index, /openImport/);
    assert.match(index, /submitImport/);
    assert.match(index, /importPgn/);
    assert.match(index, /pickPgnFile/);
    assert.match(index, /showSidePicker/);
    assert.match(index, /createFolderUnique/);
  });

  it('keeps the normal folder list when the library is not empty', () => {
    assert.match(index, /FolderListRow/);
    assert.match(index, /whiteFolders\.map\(renderFolderRow\)/);
    assert.match(index, /blackFolders\.map\(renderFolderRow\)/);
    assert.match(index, /create-folder-btn/);
  });

  it('surfaces import errors without crashing (formError path)', () => {
    assert.match(index, /setFormError/);
    assert.match(index, /formError=\{formError\}/);
    assert.match(index, /catch \(err\)/);
  });
});

describe('openings empty-state i18n', () => {
  it('provides FR / EN empty-state strings', () => {
    assert.match(translate('fr', 'openings.emptyTitle'), /pas encore de répertoire/i);
    assert.match(translate('en', 'openings.emptyTitle'), /don’t have a repertoire yet/i);
    assert.match(translate('fr', 'openings.emptyLead'), /PGN/);
    assert.match(translate('en', 'openings.emptyLead'), /PGN/i);
    assert.match(translate('fr', 'openings.emptySources'), /logiciel d’échecs|export/i);
    assert.match(translate('en', 'openings.emptySources'), /chess software|exports to PGN/i);
    assert.match(translate('fr', 'openings.emptyPurpose'), /mémoriser/);
    assert.match(translate('en', 'openings.emptyPurpose'), /memorize/);
    assert.equal(translate('fr', 'openings.importPgn'), 'Importer un PGN');
    assert.equal(translate('en', 'openings.importPgn'), 'Import a PGN');
  });

  it('does not hardcode empty-state French in OpeningEmptyState', () => {
    const src = read('components/openings/OpeningEmptyState.tsx');
    assert.doesNotMatch(src, /Tu n’as pas encore/);
    assert.doesNotMatch(src, /Importer un PGN/);
  });
});
