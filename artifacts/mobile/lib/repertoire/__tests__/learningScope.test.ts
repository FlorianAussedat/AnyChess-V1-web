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

  it('includes studies from nested folders when the tree is provided', () => {
    const folders = [
      { id: 'dragon', parentId: null },
      { id: 'maroczy', parentId: 'dragon' },
      { id: 'main', parentId: 'maroczy' },
      { id: 'other', parentId: null },
    ];
    const nested = [
      { id: 'root-study', folderId: 'dragon' },
      { id: 'maroczy-study', folderId: 'maroczy' },
      { id: 'main-study', folderId: 'main' },
      { id: 'outside', folderId: 'other' },
    ];
    assert.deepEqual(
      learningFilesInFolder(nested, 'dragon', folders).map((file) => file.id),
      ['root-study', 'maroczy-study', 'main-study'],
    );
    assert.deepEqual(
      learningFilesInFolder(nested, 'main', folders).map((file) => file.id),
      ['main-study'],
    );
  });
});
