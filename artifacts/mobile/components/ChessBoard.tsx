import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { BoardTheme } from '@/constants/boardTheme';
import { computeBoardSize, type BoardSizeMode } from '@/lib/game/boardSize';
import { PieceSvg } from './PieceSvg';
import type { PType, PColor } from './PieceSvg';

// ── Constants ──────────────────────────────────────────────────────────────

const FILES = 'abcdefgh';

const LIGHT_SQ = BoardTheme.lightSquare;
const DARK_SQ = BoardTheme.darkSquare;
const LIGHT_LAST = BoardTheme.lightLastMove;
const DARK_LAST = BoardTheme.darkLastMove;
const LIGHT_SEL = BoardTheme.lightSelected;
const DARK_SEL = BoardTheme.darkSelected;
const COORD_ON_LIGHT = BoardTheme.coordOnLight;
const COORD_ON_DARK = BoardTheme.coordOnDark;
const BORDER_COLOR = BoardTheme.border;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Return the piece at a given algebraic square from the board array. */
function pieceAtSquare(
  board: (BoardPiece | null)[][],
  square: string,
): BoardPiece | null {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1], 10);
  const row = 8 - rank;
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
  /** Hide rank/file labels for recognition exercises. */
  showCoordinates?: boolean;
  /**
   * Shared footprint mode. Default keeps historical compact sizing;
   * `wide` is ~94–96% of screen width (Classic / Repertoire game).
   */
  sizeMode?: BoardSizeMode;
  /** Optional explicit edge length (overrides sizeMode calculation). */
  size?: number;
}

export function ChessBoard({
  board,
  lastMove,
  isFlipped = false,
  selectedSquare = null,
  legalDots = [],
  onSquarePress,
  showCoordinates = true,
  sizeMode = 'default',
  size,
}: Props) {
  const { width } = useWindowDimensions();
  const boardSize = size ?? computeBoardSize(width, sizeMode);
  const cellSize = boardSize / 8;
  const pieceSize = cellSize * 0.86;
  const coordSize = cellSize * 0.21;
  const dotSize = cellSize * 0.32;
  const ringSize = cellSize * 0.88;
  const ringBorder = Math.ceil(cellSize * 0.09);

  const rows = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <View style={[styles.wrapper, { width: boardSize, height: boardSize }]}>
      {rows.map((boardRow, displayR) => (
        <View key={boardRow} style={{ flexDirection: 'row' }}>
          {cols.map((boardCol, displayC) => {
            const piece = board[boardRow]?.[boardCol] ?? null;

            // Algebraic square — same formula regardless of flip
            const sqName = FILES[boardCol] + (8 - boardRow);

            const isLight = (displayR + displayC) % 2 === 0;
            const isLastMove =
              !!lastMove && (sqName === lastMove.from || sqName === lastMove.to);
            const isSelected = sqName === selectedSquare;
            const isLegal = legalDots.includes(sqName);
            const isCapture = isLegal && piece != null;

            let bg: string;
            if (isSelected) {
              bg = isLight ? LIGHT_SEL : DARK_SEL;
            } else if (isLastMove) {
              bg = isLight ? LIGHT_LAST : DARK_LAST;
            } else {
              bg = isLight ? LIGHT_SQ : DARK_SQ;
            }

            const coordColor = isLight ? COORD_ON_LIGHT : COORD_ON_DARK;
            const showFile = displayR === 7;
            const showRank = displayC === 0;
            const fileLabel = FILES[boardCol];
            const rankLabel = String(8 - boardRow);

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
                {piece != null && (
                  <PieceSvg
                    type={piece.type as PType}
                    color={piece.color as PColor}
                    size={pieceSize}
                  />
                )}

                {isLegal && !isCapture && (
                  <View
                    style={{
                      position: 'absolute',
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: 'rgba(0,0,0,0.30)',
                    }}
                  />
                )}

                {isCapture && (
                  <View
                    style={{
                      position: 'absolute',
                      width: ringSize,
                      height: ringSize,
                      borderRadius: ringSize / 2,
                      borderWidth: ringBorder,
                      borderColor: 'rgba(0,0,0,0.32)',
                    }}
                  />
                )}

                {showCoordinates && showFile && (
                  <Text
                    style={[
                      styles.coord,
                      { fontSize: coordSize, color: coordColor, bottom: 1, right: 2 },
                    ]}
                  >
                    {fileLabel}
                  </Text>
                )}

                {showCoordinates && showRank && (
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

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: BORDER_COLOR,
    alignSelf: 'center',
  },
  coord: {
    position: 'absolute',
    fontWeight: '700',
  },
});
