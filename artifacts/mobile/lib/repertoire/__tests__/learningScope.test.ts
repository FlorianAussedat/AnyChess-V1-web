import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { learningFilesInFolder } from '../learningScope.ts';

describe('learningFilesInFolder', () => {
  const dragon = { id: 'pgn-dragon', folderId: 'folder-dragon' };
  const italian = { id: 'pgn-italian', folderId: 'folder-italian' };
  const files = [dragon, italian];

  it('keeps only the selected folder', () => {
    assert.deepEqual(learningFilesInFolder(files, 'folder-dragon'), [dragon]);
    assert.deepEqual(learningFilesInFolder(files, 'folder-italian'), [italian]);
  });

  it('does not mix another folder when the id is unknown', () => {
    assert.deepEqual(learningFilesInFolder(files, 'folder-other'), []);
  });
});
