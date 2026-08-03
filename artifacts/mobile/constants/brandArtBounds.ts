/**
 * Artwork bounds inside v1 brand PNGs (non-black content), as fractions of
 * the full canvas. Used only for layout positioning/scaling — PNGs are never edited.
 *
 * Measured from opaque, non-near-black pixels in the source files.
 */
import type { MainModeId } from '@/lib/app/modes';

export type ArtBounds = {
  /** Left edge of artwork as fraction of canvas width [0–1]. */
  left: number;
  /** Top edge of artwork as fraction of canvas height [0–1]. */
  top: number;
  /** Right edge of artwork as fraction of canvas width [0–1]. */
  right: number;
  /** Bottom edge of artwork as fraction of canvas height [0–1]. */
  bottom: number;
};

/** Horizontal logo wordmark + knight (excludes embedded tagline band). */
export const HORIZONTAL_LOGO_ART: ArtBounds = {
  left: 322 / 1536,
  top: 349 / 1024,
  right: 1162 / 1536,
  bottom: 545 / 1024,
};

/** Accueil nav knight — centered subject in portrait canvas. */
export const NAV_HOME_ART: ArtBounds = {
  left: 318 / 1024,
  top: 521 / 1536,
  right: 772 / 1024,
  bottom: 959 / 1536,
};

/**
 * ModeCard mascot artwork. Subjects sit in the upper-middle of each 1024×1536
 * canvas with large empty black padding below — bottom-aligning the raw Image
 * crops heads. Layout must align these art bounds to the card bottom-right.
 */
export const MASCOT_ART: Record<MainModeId, ArtBounds> = {
  classic: {
    left: 316 / 1024,
    top: 403 / 1536,
    right: 809 / 1024,
    bottom: 922 / 1536,
  },
  openings: {
    left: 205 / 1024,
    top: 305 / 1536,
    right: 790 / 1024,
    bottom: 926 / 1536,
  },
  blind: {
    left: 299 / 1024,
    top: 350 / 1536,
    right: 794 / 1024,
    bottom: 954 / 1536,
  },
  puzzles: {
    left: 220 / 1024,
    top: 410 / 1536,
    right: 876 / 1024,
    bottom: 969 / 1536,
  },
  visualisation: {
    left: 267 / 1024,
    top: 367 / 1536,
    right: 738 / 1024,
    bottom: 899 / 1536,
  },
  'quiz-ouverture': {
    left: 285 / 1024,
    top: 349 / 1536,
    right: 821 / 1024,
    bottom: 1054 / 1536,
  },
};

export function artWidth(b: ArtBounds): number {
  return b.right - b.left;
}

export function artHeight(b: ArtBounds): number {
  return b.bottom - b.top;
}
