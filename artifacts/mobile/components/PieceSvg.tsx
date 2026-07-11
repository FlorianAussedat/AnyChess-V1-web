/**
 * SVG chess pieces — clean Staunton-inspired style.
 * All pieces render in a 45×45 viewBox scaled to `size` pixels.
 */
import React from 'react';
import Svg, { G, Path, Circle, Rect } from 'react-native-svg';

// ── Types ──────────────────────────────────────────────────────────────────

export type PColor = 'w' | 'b';
export type PType  = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

interface Props { type: PType; color: PColor; size: number }

// ── Palettes ───────────────────────────────────────────────────────────────

const W = { fill: '#F2F2F2', hi: '#FFFFFF', sh: '#C8C8C8', stroke: '#2A2A2A', sw: 1.5 };
const B = { fill: '#1C1C30', hi: '#30304A', sh: '#0A0A18', stroke: '#9090B8', sw: 1.5 };

function p(c: PColor) { return c === 'w' ? W : B; }

// ── Shared base (collar + foot) used by all pieces ─────────────────────────
// Assumes piece body ends at y ≈ 30.5

function Base({ c }: { c: PColor }) {
  const { fill, stroke, sw } = p(c);
  return (
    <G>
      {/* collar */}
      <Rect x="12.5" y="30.5" width="20" height="3" rx="0.5"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* foot */}
      <Path d="M 10 33.5 L 35 33.5 L 35 36.5 Q 22.5 40.5 10 36.5 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
    </G>
  );
}

// ── PAWN ───────────────────────────────────────────────────────────────────

function Pawn({ c }: { c: PColor }) {
  const { fill, stroke, sw } = p(c);
  return (
    <G>
      {/* ball head */}
      <Circle cx="22.5" cy="11.5" r="5.5"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* funnel body */}
      <Path d="M 18.5 27.5 C 18 21.5 27 21.5 26.5 27.5 L 27.5 30.5 L 17.5 30.5 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      <Base c={c} />
    </G>
  );
}

// ── ROOK ───────────────────────────────────────────────────────────────────

function Rook({ c }: { c: PColor }) {
  const { fill, stroke, sw } = p(c);
  // Crenellated top: three merlons, two gaps
  return (
    <G>
      {/* battlements silhouette */}
      <Path
        d="M 12 8 L 12 15 L 16.5 15 L 16.5 11 L 19.5 11 L 19.5 15
           L 25.5 15 L 25.5 11 L 28.5 11 L 28.5 15 L 33 15 L 33 8 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* main body */}
      <Rect x="12" y="15" width="21" height="15.5"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      <Base c={c} />
    </G>
  );
}

// ── BISHOP ────────────────────────────────────────────────────────────────

function Bishop({ c }: { c: PColor }) {
  const { fill, stroke, sw } = p(c);
  const detail = c === 'w' ? '#2A2A2A' : '#9090B8';
  return (
    <G>
      {/* finial ball */}
      <Circle cx="22.5" cy="7.5" r="3"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* mitre body */}
      <Path
        d="M 22.5 10 C 19 11.5 16.5 16 16.5 20.5
           C 16.5 25.5 19.5 29 22.5 30
           C 25.5 29 28.5 25.5 28.5 20.5
           C 28.5 16 26 11.5 22.5 10 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* identifying cross marks */}
      <Path d="M 19.5 20 L 25.5 20" stroke={detail} strokeWidth={1.2} fill="none" />
      <Path d="M 22.5 17 L 22.5 23" stroke={detail} strokeWidth={1.2} fill="none" />
      <Base c={c} />
    </G>
  );
}

// ── KNIGHT ────────────────────────────────────────────────────────────────

function Knight({ c }: { c: PColor }) {
  const { fill, stroke, sw } = p(c);
  const eye = c === 'w' ? '#2A2A2A' : '#9090B8';
  return (
    <G>
      {/* horse-head silhouette (facing right) */}
      <Path
        d="M 22 10.5
           C 20 10.5 17.5 11.5 15.5 14
           C 13.5 17 14 21.5 16.5 24.5
           L 14 30.5 L 31 30.5 L 31 27
           C 33 25 35 22 34 17.5
           C 33 13 29 10.5 25 10.5 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* ear */}
      <Path d="M 20.5 10.5 L 18.5 7 L 26 7 L 26 10.5"
        fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      {/* eye */}
      <Circle cx="19.5" cy="14.5" r="1.8"
        fill={eye} />
      {/* nostril */}
      <Circle cx="17" cy="20" r="1"
        fill={eye} />
      <Base c={c} />
    </G>
  );
}

// ── QUEEN ─────────────────────────────────────────────────────────────────

function Queen({ c }: { c: PColor }) {
  const { fill, stroke, sw } = p(c);
  const detail = c === 'w' ? '#2A2A2A' : '#9090B8';
  return (
    <G>
      {/* 5 crown orbs */}
      <Circle cx="11.5" cy="15" r="2.5" fill={fill} stroke={stroke} strokeWidth={sw} />
      <Circle cx="17"   cy="12" r="2.5" fill={fill} stroke={stroke} strokeWidth={sw} />
      <Circle cx="22.5" cy="10.5" r="3" fill={fill} stroke={stroke} strokeWidth={sw} />
      <Circle cx="28"   cy="12" r="2.5" fill={fill} stroke={stroke} strokeWidth={sw} />
      <Circle cx="33.5" cy="15" r="2.5" fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* vase body */}
      <Path
        d="M 11.5 15 Q 15 19.5 22.5 21 Q 30 19.5 33.5 15 L 33.5 30.5 L 11.5 30.5 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* waist */}
      <Path d="M 14.5 24.5 Q 22.5 27 30.5 24.5"
        stroke={detail} strokeWidth={1.2} fill="none" />
      <Base c={c} />
    </G>
  );
}

// ── KING ──────────────────────────────────────────────────────────────────

function King({ c }: { c: PColor }) {
  const { fill, stroke, sw } = p(c);
  const cross = c === 'w' ? '#2A2A2A' : '#9090B8';
  return (
    <G>
      {/* cross — vertical bar */}
      <Rect x="21" y="4.5" width="3" height="11"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* cross — horizontal bar */}
      <Rect x="16.5" y="7.5" width="12" height="3"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* body */}
      <Path
        d="M 14 16.5 Q 22.5 20.5 31 16.5 L 31 30.5 L 14 30.5 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* waist */}
      <Path d="M 15.5 24.5 Q 22.5 27 29.5 24.5"
        stroke={cross} strokeWidth={1.2} fill="none" />
      <Base c={c} />
    </G>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export function PieceSvg({ type, color, size }: Props) {
  const piece = (() => {
    switch (type) {
      case 'p': return <Pawn   c={color} />;
      case 'r': return <Rook   c={color} />;
      case 'b': return <Bishop c={color} />;
      case 'n': return <Knight c={color} />;
      case 'q': return <Queen  c={color} />;
      case 'k': return <King   c={color} />;
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 45 45">
      {piece}
    </Svg>
  );
}
