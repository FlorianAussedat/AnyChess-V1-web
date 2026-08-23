/**
 * Non-interactive mini chess diagram for catalog cards / list rows.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import type { BoardPiece } from '@/contexts/GameContext';

type Props = {
  fen: string;
  size: number;
  flipped?: boolean;
  testID?: string;
};

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

export function TheoreticalMiniDiagram({ fen, size, flipped = false, testID }: Props) {
  const board = useMemo(() => {
    try {
      return boardFromFen(fen);
    } catch {
      return boardFromFen('8/8/8/8/8/8/8/8 w - - 0 1');
    }
  }, [fen]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]} testID={testID} pointerEvents="none">
      <ChessBoard
        board={board}
        lastMove={null}
        isFlipped={flipped}
        selectedSquare={null}
        legalDots={[]}
        showCoordinates={false}
        size={size}
        sizeMode="default"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
});
