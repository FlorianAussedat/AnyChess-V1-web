/**
 * Artwork bounds inside brand PNGs (non-black content), as fractions of
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

export const HORIZONTAL_LOGO_CANVAS = { width: 1536, height: 1024 } as const;
export const LAUNCH_PORTRAIT_CANVAS = { width: 936, height: 1024 } as const;

/**
 * Horizontal logo, wordmark, and embedded tagline measured from the
 * supplied 1536×1024 PNG. Bottom includes the full slogan band.
 */
export const HORIZONTAL_LOGO_ART: ArtBounds = {
  left: 322 / HORIZONTAL_LOGO_CANVAS.width,
  top: 347 / HORIZONTAL_LOGO_CANVAS.height,
  right: 1165 / HORIZONTAL_LOGO_CANVAS.width,
  bottom: 595 / HORIZONTAL_LOGO_CANVAS.height,
};

/** Knight + wordmark only — slogan is rendered as localized text. */
export const HORIZONTAL_LOGO_WORDMARK: ArtBounds = {
  left: 322 / HORIZONTAL_LOGO_CANVAS.width,
  top: 347 / HORIZONTAL_LOGO_CANVAS.height,
  right: 1165 / HORIZONTAL_LOGO_CANVAS.width,
  bottom: 548 / HORIZONTAL_LOGO_CANVAS.height,
};

/**
 * Launch portrait artwork (knight + AnyChess + slogan) inside the
 * supplied 936×1024 PNG. Transparent margins are cropped at layout time.
 */
export const LAUNCH_PORTRAIT_ART: ArtBounds = {
  left: 129 / LAUNCH_PORTRAIT_CANVAS.width,
  top: 347 / LAUNCH_PORTRAIT_CANVAS.height,
  right: 693 / LAUNCH_PORTRAIT_CANVAS.width,
  bottom: 810 / LAUNCH_PORTRAIT_CANVAS.height,
};

/** Accueil nav knight — centered subject in portrait canvas. */
export const NAV_HOME_ART: ArtBounds = {
  left: 318 / 1024,
  top: 521 / 1536,
  right: 772 / 1024,
  bottom: 959 / 1536,
};

/**
 * ModeCard mascot artwork. Subjects sit in the upper-middle of each portrait
 * 2:3 canvas with large empty black padding below — bottom-aligning the raw Image
 * crops heads. Layout must align these art bounds to the card bottom-right.
 * Bounds are fractions of canvas size (stable across proportional resizes).
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
  parties: {
    // Square DJ canvas (1254×1254) — subject nearly fills the frame.
    left: 174 / 1254,
    top: 53 / 1254,
    right: 1104 / 1254,
    bottom: 1185 / 1254,
  },
};

/** Canvas width/height for ModeCard scaling (most mascots are 2:3 portraits). */
export function mascotCanvasAspect(modeId: MainModeId): number {
  if (modeId === 'parties') return 1;
  return 1024 / 1536;
}

export function artWidth(b: ArtBounds): number {
  return b.right - b.left;
}

export function artHeight(b: ArtBounds): number {
  return b.bottom - b.top;
}
