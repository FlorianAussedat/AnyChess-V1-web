import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ChessBoard } from '@/components/ChessBoard';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { sfxService } from '@/services/SfxService';

export function BlindReconstructionPhase() {
  const colors = useColors();
  const {
    board,
    lastMove,
    orientation,
    sequence,
    expectedIndex,
    lastFeedback,
    revealedHint,
    getLegalDestinations,
    attemptMove,
    useHelp,
    backToSettings,
  } = useBlindSequence();

  const [selected, setSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);

  useEffect(() => {
    setSelected(null);
    setLegalDests([]);
  }, [expectedIndex]);

  const onSquarePress = useCallback(
    (square: string) => {
      if (selected === null) {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setSelected(square);
          setLegalDests(dests);
        }
      } else if (square === selected) {
        setSelected(null);
        setLegalDests([]);
      } else if (legalDests.includes(square)) {
        const ok = attemptMove(selected, square);
        if (!ok) void sfxService.playError();
        else void sfxService.playSuccess();
        setSelected(null);
        setLegalDests([]);
      } else {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setSelected(square);
          setLegalDests(dests);
        } else {
          setSelected(null);
          setLegalDests([]);
        }
      }
    },
    [selected, legalDests, getLegalDestinations, attemptMove],
  );

  return (
    <ModeScreenShell title="Reconstruction" onBack={backToSettings}>
      <View style={blindStyles.phaseBody}>
        <View style={[blindStyles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
            Coup {Math.min(expectedIndex + 1, sequence.length)} / {sequence.length}
          </Text>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
            {lastFeedback ?? 'Reproduis le prochain coup.'}
          </Text>
          {!!revealedHint && (
            <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
              {revealedHint}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'center' }}>
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={orientation === 'b'}
            selectedSquare={selected}
            legalDots={legalDests}
            onSquarePress={onSquarePress}
          />
        </View>
        <Pressable
          onPress={useHelp}
          style={({ pressed }) => [
            blindStyles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="help-circle-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Aide — révéler le coup
          </Text>
        </Pressable>
      </View>
    </ModeScreenShell>
  );
}
