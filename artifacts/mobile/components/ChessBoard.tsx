import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';

// ── Constants ──────────────────────────────────────────────────────────────

const PIECES: Record<string, string> = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};

const FILES = 'abcdefgh';

const LIGHT_SQ = '#e8d9b5';
const DARK_SQ  = '#8a6650';
const LIGHT_LAST = 'rgba(255,220,30,0.70)';
const DARK_LAST  = 'rgba(200,145,0,0.66)';
const LIGHT_SEL  = 'rgba(20,148,220,0.72)';
const DARK_SEL   = 'rgba(10,115,180,0.72)';
const COORD_ON_LIGHT = 'rgba(100,70,45,0.80)';
const COORD_ON_DARK  = 'rgba(225,200,150,0.80)';
const BORDER_COLOR   = '#8795a1';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Return the piece at a given algebraic square from the board array. */
function pieceAtSquare(
  board: (BoardPiece | null)[][],
  square: string,
): BoardPiece | null {
  const file = square.charCodeAt(0) - 97; // a=0…h=7
  const rank = parseInt(square[1], 10);   // 1…8
  const row  = 8 - rank;                  // board row index
  return board[row]?.[file] ?? null;
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  board: (BoardPiece | null)[][];
  lastMove: LastMove | null;
  /** Flip the board so Black's pieces appear at the bottom. */
  isFlipped?: boolean;
  /** Currently selected piece square (for touch moves). */
  selectedSquare?: string | null;
  /** Legal destination squares to mark (dots / rings). */
  legalDots?: string[];
  /** Called when the user taps a square. */
  onSquarePress?: (square: string) => void;
}

export function ChessBoard({
  board,
  lastMove,
  isFlipped = false,
  selectedSquare = null,
  legalDots = [],
  onSquarePress,
}: Props) {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 20, 352);
  const cellSize  = boardSize / 8;
  const pieceSize = cellSize * 0.70;
  const coordSize = cellSize * 0.21;
  const dotSize   = cellSize * 0.32;
  const ringSize  = cellSize * 0.88;
  const ringBorder = Math.ceil(cellSize * 0.09);

  const rows = isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const cols = isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  return (
    <View style={[styles.wrapper, { width: boardSize, height: boardSize }]}>
      {rows.map((boardRow, displayR) => (
        <View key={boardRow} style={{ flexDirection: 'row' }}>
          {cols.map((boardCol, displayC) => {
            const piece = board[boardRow]?.[boardCol] ?? null;

            // Algebraic square name
            const sqName = isFlipped
              ? FILES[7 - boardCol] + (boardRow + 1)
              : FILES[boardCol] + (8 - boardRow);

            const isLight    = (displayR + displayC) % 2 === 0;
            const isLastMove = !!lastMove && (sqName === lastMove.from || sqName === lastMove.to);
            const isSelected = sqName === selectedSquare;
            const isLegal    = legalDots.includes(sqName);
            const isCapture  = isLegal && piece != null;

            // Background colour priority: selected > lastMove > plain
            let bg: string;
            if (isSelected) {
              bg = isLight ? LIGHT_SEL : DARK_SEL;
            } else if (isLastMove) {
              bg = isLight ? LIGHT_LAST : DARK_LAST;
            } else {
              bg = isLight ? LIGHT_SQ : DARK_SQ;
            }

            const coordColor = isLight ? COORD_ON_LIGHT : COORD_ON_DARK;

            // Bottom-row file label (last display row)
            const showFile  = displayR === 7;
            // Left-column rank label
            const showRank  = displayC === 0;
            const fileLabel = isFlipped ? FILES[7 - boardCol] : FILES[boardCol];
            const rankLabel = isFlipped ? String(boardRow + 1) : String(8 - boardRow);

            const cell = (
              <View
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Piece */}
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

                {/* Legal-move dot (empty destination) */}
                {isLegal && !isCapture && (
                  <View
                    style={{
                      position: 'absolute',
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: 'rgba(0,0,0,0.28)',
                    }}
                  />
                )}

                {/* Legal-move ring (capture destination) */}
                {isCapture && (
                  <View
                    style={{
                      position: 'absolute',
                      width: ringSize,
                      height: ringSize,
                      borderRadius: ringSize / 2,
                      borderWidth: ringBorder,
                      borderColor: 'rgba(0,0,0,0.30)',
                    }}
                  />
                )}

                {/* File coordinate */}
                {showFile && (
                  <Text
                    style={[
                      styles.coord,
                      { fontSize: coordSize, color: coordColor, bottom: 1, right: 2 },
                    ]}
                  >
                    {fileLabel}
                  </Text>
                )}

                {/* Rank coordinate */}
                {showRank && (
                  <Text
                    style={[
                      styles.coord,
                      { fontSize: coordSize, color: coordColor, top: 1, left: 2 },
                    ]}
                  >
                    {rankLabel}
                  </Text>
                )}
              </View>
            );

            // Wrap in Pressable only when there is a press handler
            if (!onSquarePress) {
              return <View key={boardCol}>{cell}</View>;
            }

            return (
              <Pressable
                key={boardCol}
                onPress={() => onSquarePress(sqName)}
                style={{ width: cellSize, height: cellSize }}
              >
                {cell}
              </Pressable>
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
