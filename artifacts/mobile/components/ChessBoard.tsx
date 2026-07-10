import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';

// ── Constants ──────────────────────────────────────────────────────────────

const PIECES: Record<string, string> = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};

const FILES = 'abcdefgh';

const LIGHT_SQ = '#e8d9b5';
const DARK_SQ = '#8a6650';
const LIGHT_LAST = 'rgba(255,220,30,0.72)';
const DARK_LAST = 'rgba(200,145,0,0.68)';
const COORD_ON_LIGHT = 'rgba(100,70,45,0.80)';
const COORD_ON_DARK = 'rgba(225,200,150,0.80)';
const BORDER_COLOR = '#8795a1';

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  board: (BoardPiece | null)[][];
  lastMove: LastMove | null;
}

export function ChessBoard({ board, lastMove }: Props) {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 20, 352);
  const cellSize = boardSize / 8;
  const pieceSize = cellSize * 0.70;
  const coordSize = cellSize * 0.21;

  return (
    <View
      style={[
        styles.wrapper,
        { width: boardSize, height: boardSize },
      ]}
    >
      {board.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((piece, f) => {
            const sqName = FILES[f] + (8 - r);
            const isLight = (r + f) % 2 === 0;
            const isLast =
              lastMove != null &&
              (sqName === lastMove.from || sqName === lastMove.to);

            const bg = isLast
              ? isLight ? LIGHT_LAST : DARK_LAST
              : isLight ? LIGHT_SQ : DARK_SQ;

            const coordColor = isLight ? COORD_ON_LIGHT : COORD_ON_DARK;

            return (
              <View
                key={f}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {piece != null && (
                  <Text
                    style={{
                      fontSize: pieceSize,
                      lineHeight: cellSize,
                      textAlign: 'center',
                      includeFontPadding: false,
                    }}
                  >
                    {PIECES[piece.color + piece.type] ?? ''}
                  </Text>
                )}

                {/* File label (bottom-right on rank 1) */}
                {r === 7 && (
                  <Text
                    style={[
                      styles.coord,
                      { fontSize: coordSize, color: coordColor, bottom: 1, right: 2 },
                    ]}
                  >
                    {FILES[f]}
                  </Text>
                )}

                {/* Rank label (top-left on a-file) */}
                {f === 0 && (
                  <Text
                    style={[
                      styles.coord,
                      { fontSize: coordSize, color: coordColor, top: 1, left: 2 },
                    ]}
                  >
                    {8 - r}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BORDER_COLOR,
    alignSelf: 'center',
  },
  coord: {
    position: 'absolute',
    fontWeight: '700',
  },
});
