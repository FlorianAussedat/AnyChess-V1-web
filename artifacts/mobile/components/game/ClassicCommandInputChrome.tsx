/**
 * Classic Game input chrome reused by exercise boards:
 * keypad (when active) → compact mic + keyboard toggle.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChessKeyboardToggle } from '@/components/game/ChessKeyboardToggle';
import { ChessMoveKeypad } from '@/components/game/ChessMoveKeypad';
import { GameMicButton } from '@/components/game/GameMicButton';
import { DesignTokens } from '@/constants/designTokens';

type SpeechBits = {
  showRecognized: boolean;
  listening: boolean;
  micActive: boolean;
  toggleListening: () => void;
};

type Props = {
  keypadActive: boolean;
  draftMove: string;
  onChangeDraft: (value: string) => void;
  onSubmit: (raw: string) => void;
  fen: string;
  canAct: boolean;
  speech: SpeechBits;
  onToggleInput: () => void;
  keypadTestID: string;
  commandRowTestID: string;
  micTestID: string;
  toggleTestID: string;
};

export function ClassicCommandInputChrome({
  keypadActive,
  draftMove,
  onChangeDraft,
  onSubmit,
  fen,
  canAct,
  speech,
  onToggleInput,
  keypadTestID,
  commandRowTestID,
  micTestID,
  toggleTestID,
}: Props) {
  return (
    <>
      {keypadActive ? (
        <ChessMoveKeypad
          value={draftMove}
          onChangeText={onChangeDraft}
          onSubmit={onSubmit}
          autoSubmit
          fen={fen}
          compact
          enabled={canAct}
          testID={keypadTestID}
        />
      ) : null}

      <View style={styles.commandRow} testID={commandRowTestID}>
        <GameMicButton
          showRecognized={speech.showRecognized}
          isListening={speech.listening}
          micActive={speech.micActive}
          onToggle={speech.toggleListening}
          testID={micTestID}
          variant="compact"
        />
        <ChessKeyboardToggle
          active={keypadActive}
          onToggle={onToggleInput}
          variant="classic"
          testID={toggleTestID}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
  },
});
