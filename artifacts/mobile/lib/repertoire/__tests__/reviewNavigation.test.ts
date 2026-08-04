/**
 * Review navigation + mode choice routing tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBoardReviewHref,
  buildContinueReviewHref,
  buildFolderPlayHref,
  buildReviewHref,
  canonicalizeFolderIds,
  resolveReviewFolderIds,
} from '../reviewNavigation.ts';
import type { RepertoireFolder } from '../storage/types.ts';

const folders: RepertoireFolder[] = [
  { id: 'w1', name: 'W1', side: 'white', createdAt: '', updatedAt: '' },
  { id: 'w2', name: 'W2', side: 'white', createdAt: '', updatedAt: '' },
  { id: 'b1', name: 'B1', side: 'black', createdAt: '', updatedAt: '' },
  { id: 'x1', name: 'Unset', createdAt: '', updatedAt: '' },
];

describe('reviewNavigation', () => {
  it('resolves Review All / White / Black folder pools', () => {
    assert.deepEqual(resolveReviewFolderIds(folders, 'all').sort(), ['b1', 'w1', 'w2']);
    assert.deepEqual(resolveReviewFolderIds(folders, 'white').sort(), ['w1', 'w2']);
    assert.deepEqual(resolveReviewFolderIds(folders, 'black'), ['b1']);
  });

  it('canonicalizes folder id order', () => {
    assert.deepEqual(canonicalizeFolderIds(['c', 'a', 'b']), ['a', 'b', 'c']);
    assert.deepEqual(
      canonicalizeFolderIds(['folderC', 'folderA', 'folderB']),
      canonicalizeFolderIds(['folderA', 'folderB', 'folderC']),
    );
  });

  it('builds continue and board hrefs preserving side filter', () => {
    const scope = { folderIds: ['w1', 'w2'], side: 'white' as const };
    assert.equal(
      buildContinueReviewHref(scope),
      '/openings/continue?folderIds=w1%2Cw2&side=white',
    );
    assert.equal(
      buildBoardReviewHref(scope),
      '/openings/play?folderIds=w1%2Cw2&side=white',
    );
    assert.equal(buildReviewHref(scope, 'continue'), buildContinueReviewHref(scope));
    assert.equal(buildReviewHref(scope, 'board'), buildBoardReviewHref(scope));
  });

  it('covers all + white + black for both modes', () => {
    const all = { folderIds: ['w1', 'b1'], side: 'all' as const };
    const white = { folderIds: ['w1'], side: 'white' as const };
    const black = { folderIds: ['b1'], side: 'black' as const };
    const custom = { folderIds: ['w2', 'b1'], side: 'all' as const };

    for (const scope of [all, white, black, custom]) {
      const c = buildReviewHref(scope, 'continue');
      const b = buildReviewHref(scope, 'board');
      assert.match(c, /\/openings\/continue\?/);
      assert.match(b, /\/openings\/play\?/);
      assert.match(c, new RegExp(`side=${scope.side}`));
      assert.match(b, new RegExp(`side=${scope.side}`));
      assert.ok(c.includes('folderIds='));
      assert.ok(b.includes('folderIds='));
    }
  });

  it('locks single-folder play to repertoire side color', () => {
    assert.equal(
      buildFolderPlayHref('f1', 'white'),
      '/openings/play?folderId=f1&color=w&sideLocked=1',
    );
    assert.equal(
      buildFolderPlayHref('f1', 'black'),
      '/openings/play?folderId=f1&color=b&sideLocked=1',
    );
  });
});
