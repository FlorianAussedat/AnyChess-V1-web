/**
 * Home mascot slot must show the full measured artwork, including the
 * wide tactics knight + calculator symbols.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MASCOT_ART,
  MODE_CARD_MASCOT_SLOT,
  artHeight,
  artWidth,
  containArtInSlot,
  mascotCanvasAspect,
} from '../brandArtBounds.ts';
import type { MainModeId } from '../../lib/app/modes.ts';

const SLOT = MODE_CARD_MASCOT_SLOT;

function artEdges(
  modeId: MainModeId,
): { left: number; right: number; top: number; bottom: number } {
  const art = MASCOT_ART[modeId];
  const layout = containArtInSlot(
    art,
    mascotCanvasAspect(modeId),
    SLOT.width,
    SLOT.height,
    SLOT.pad,
  );
  const right = SLOT.width - layout.imageRight - (1 - art.right) * layout.imgWidth;
  const left = right - artWidth(art) * layout.imgWidth;
  const bottom = SLOT.height - layout.imageBottom - (1 - art.bottom) * layout.imgHeight;
  const top = bottom - artHeight(art) * layout.imgHeight;
  return { left, right, top, bottom };
}

describe('containArtInSlot', () => {
  it('keeps every home mascot, including tactics symbols, inside the padded slot', () => {
    for (const modeId of Object.keys(MASCOT_ART) as MainModeId[]) {
      const edges = artEdges(modeId);
      assert.ok(edges.left >= SLOT.pad - 1, `${modeId} left ${edges.left}`);
      assert.ok(edges.top >= SLOT.pad - 1, `${modeId} top ${edges.top}`);
      assert.ok(edges.right <= SLOT.width - SLOT.pad + 1, `${modeId} right ${edges.right}`);
      assert.ok(
        edges.bottom <= SLOT.height - SLOT.pad + 1,
        `${modeId} bottom ${edges.bottom}`,
      );
    }
  });

  it('uses a wider puzzles art box than the previous 112px right-aligned crop', () => {
    const puzzles = MASCOT_ART.puzzles;
    assert.ok(artWidth(puzzles) > 0.6, 'tactics art is the widest home mascot');
    const edges = artEdges('puzzles');
    assert.ok(edges.right - edges.left >= 90);
    assert.ok(edges.left >= 5);
  });
});
