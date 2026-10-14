/**
 * Eval curve geometry.
 * White-centric pawns are capped for the plot; the exact label stays separate.
 * Missing samples break the line instead of becoming 0.00.
 * Segment frames are centered so a rotation around the view center stays on the chord.
 */
import { formatAnyLyseurEval, isEvalPresent, type WhiteEval } from './formatEval.ts';

export const EVAL_CURVE_PAWN_CAP = 5;

export type CurveSample = {
  id: string;
  fen: string;
  /** PGN move number of the ply that reached this position. */
  moveNumber: number | null;
  plyColor: 'w' | 'b' | null;
  evaluation: number | null;
  mate: number | null;
  terminalOutcome?: 'white' | 'black' | 'draw';
};

export type CurvePointKind = 'cp' | 'mate' | 'terminal' | 'missing';

export type LaidPoint = {
  id: string;
  fen: string;
  x: number;
  y: number | null;
  moveNumber: number | null;
  kind: CurvePointKind;
  capped: boolean;
  exactLabel: string | null;
};

export type LaidSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type CurveTick = { x: number; label: string };

export type EvalCurveLayout = {
  width: number;
  height: number;
  plotLeft: number;
  plotTop: number;
  plotRight: number;
  plotBottom: number;
  equalityY: number;
  scaleCapped: boolean;
  points: LaidPoint[];
  segments: LaidSegment[];
  ticks: CurveTick[];
};

export type SegmentFrame = {
  left: number;
  top: number;
  width: number;
  angle: number;
};

const PAD_X = 12;
const PAD_Y = 10;
const STROKE = 2;

function finite(n: number): boolean {
  return Number.isFinite(n);
}

function placeY(
  value: WhiteEval,
  top: number,
  bottom: number,
  cap: number,
): { y: number | null; kind: CurvePointKind; capped: boolean } {
  if (!isEvalPresent(value)) return { y: null, kind: 'missing', capped: false };
  const mid = (top + bottom) / 2;
  const half = (bottom - top) / 2;
  if (value.terminalOutcome === 'draw') {
    return { y: mid, kind: 'terminal', capped: false };
  }
  if (value.terminalOutcome === 'white' || (value.mate != null && value.mate > 0)) {
    return { y: top, kind: value.terminalOutcome ? 'terminal' : 'mate', capped: true };
  }
  if (value.terminalOutcome === 'black' || (value.mate != null && value.mate < 0)) {
    return { y: bottom, kind: value.terminalOutcome ? 'terminal' : 'mate', capped: true };
  }
  const pawns = (value.cp ?? 0) / 100;
  const capped = Math.abs(pawns) > cap + 1e-9;
  const shown = Math.max(-cap, Math.min(cap, pawns));
  const y = mid - (shown / cap) * half;
  return { y, kind: 'cp', capped };
}

export function layoutEvalCurve(
  samples: CurveSample[],
  width: number,
  height: number,
  cap = EVAL_CURVE_PAWN_CAP,
): EvalCurveLayout {
  const safeWidth = finite(width) && width > 0 ? width : 0;
  const safeHeight = finite(height) && height > 0 ? height : 0;
  const plotLeft = Math.min(PAD_X, Math.max(0, safeWidth / 2));
  const plotRight = Math.max(plotLeft, safeWidth - PAD_X);
  const plotTop = Math.min(PAD_Y, Math.max(0, safeHeight / 2));
  const plotBottom = Math.max(plotTop, safeHeight - PAD_Y);
  const innerTop = Math.min(plotBottom, plotTop + STROKE);
  const innerBottom = Math.max(innerTop, plotBottom - STROKE);
  const equalityY = (innerTop + innerBottom) / 2;
  const span = Math.max(1, plotRight - plotLeft);
  const n = samples.length;

  const points: LaidPoint[] = samples.map((sample, index) => {
    const x =
      n <= 1 ? plotLeft + span / 2 : plotLeft + (index / (n - 1)) * span;
    const placed = placeY(
      {
        cp: sample.evaluation,
        mate: sample.mate,
        terminalOutcome: sample.terminalOutcome,
      },
      innerTop,
      innerBottom,
      cap,
    );
    const y = placed.y != null && finite(placed.y) ? placed.y : null;
    return {
      id: sample.id,
      fen: sample.fen,
      x: finite(x) ? x : plotLeft,
      y,
      moveNumber: sample.moveNumber,
      kind: y == null ? 'missing' : placed.kind,
      capped: placed.capped,
      exactLabel: formatAnyLyseurEval({
        cp: sample.evaluation,
        mate: sample.mate,
        terminalOutcome: sample.terminalOutcome,
      }),
    };
  });

  const segments: LaidSegment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    if (prev.y == null || next.y == null) continue;
    segments.push({ x1: prev.x, y1: prev.y, x2: next.x, y2: next.y });
  }

  const ticks: CurveTick[] = [];
  const minGap = 36;
  let lastX = -Infinity;
  samples.forEach((sample, index) => {
    if (sample.plyColor !== 'w' || sample.moveNumber == null) return;
    const point = points[index]!;
    if (ticks.length > 0 && point.x - lastX < minGap) return;
    ticks.push({ x: point.x, label: String(sample.moveNumber) });
    lastX = point.x;
  });

  return {
    width: safeWidth,
    height: safeHeight,
    plotLeft,
    plotTop,
    plotRight,
    plotBottom,
    equalityY,
    scaleCapped: points.some((point) => point.capped),
    points,
    segments,
    ticks,
  };
}

/** Nearest sample by horizontal position, including gaps. */
export function hitTestCurve(layout: EvalCurveLayout, x: number): string | null {
  if (!finite(x) || layout.points.length === 0) return null;
  let best = layout.points[0]!;
  let bestDist = Math.abs(best.x - x);
  for (const point of layout.points) {
    const dist = Math.abs(point.x - x);
    if (dist < bestDist) {
      best = point;
      bestDist = dist;
    }
  }
  return best.id;
}

/**
 * Place the segment view on the chord midpoint.
 * React Native rotates around the view center, so the left edge must not sit on x1.
 */
export function segmentFrame(segment: LaidSegment): SegmentFrame {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const len = Math.hypot(dx, dy);
  const midX = (segment.x1 + segment.x2) / 2;
  const midY = (segment.y1 + segment.y2) / 2;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    left: midX - len / 2,
    top: midY - STROKE / 2,
    width: len,
    angle: finite(angle) ? angle : 0,
  };
}

export function layoutInsidePlot(layout: EvalCurveLayout): boolean {
  if (layout.width <= 0 || layout.height <= 0) return layout.points.length === 0;
  const inX = (x: number) =>
    finite(x) && x >= layout.plotLeft - 0.01 && x <= layout.plotRight + 0.01;
  const inY = (y: number) =>
    finite(y) && y >= layout.plotTop - 0.01 && y <= layout.plotBottom + 0.01;
  for (const point of layout.points) {
    if (!inX(point.x)) return false;
    if (point.y != null && !inY(point.y)) return false;
  }
  for (const segment of layout.segments) {
    if (!inX(segment.x1) || !inX(segment.x2)) return false;
    if (!inY(segment.y1) || !inY(segment.y2)) return false;
    const frame = segmentFrame(segment);
    if (!finite(frame.left) || !finite(frame.top) || !finite(frame.width) || !finite(frame.angle)) {
      return false;
    }
  }
  for (const tick of layout.ticks) {
    if (!inX(tick.x)) return false;
  }
  return true;
}
