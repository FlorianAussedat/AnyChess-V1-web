/**
 * Shared board block: optional toolbar above a centered board (or placeholder).
 * Matches Classic Game board placement / width contract.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  boardSize: number;
  children: React.ReactNode;
  /** Optional toolbar / labels above the board (e.g. BoardToolbar). */
  toolbar?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ChessBoardSection({
  boardSize,
  children,
  toolbar,
  style,
  testID = 'chess-board-section',
}: Props) {
  return (
    <View
      style={[styles.block, { width: boardSize }, style]}
      testID={testID}
    >
      {toolbar}
      <View style={styles.row}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 0, alignSelf: 'center' },
  row: { alignItems: 'center' },
});
