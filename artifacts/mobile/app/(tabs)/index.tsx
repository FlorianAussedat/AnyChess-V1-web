import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useColors } from '@/hooks/useColors';
import { ChessBoard } from '@/components/ChessBoard';
import { useGame } from '@/contexts/GameContext';
import type { PlayerColor } from '@/contexts/GameContext';

// ── Types ──────────────────────────────────────────────────────────────────

type MoveRow = { key: string; num: number; white: string; black: string };

// ── Screen ─────────────────────────────────────────────────────────────────

export default function GameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const {
    board,
    history,
    status,
    heardText,
    lastMove,
    isGameOver,
    waitingForUser,
    isOpponentThinking,
    playerColor,
    applyUserMove,
    movePieceBySquare,
    getLegalDestinations,
    newGame,
    changeColor,
    repeatLast,
  } = useGame();

  // Stable ref so STT event handlers never hold stale closure
  const applyRef = useRef(applyUserMove);
  useEffect(() => { applyRef.current = applyUserMove; }, [applyUserMove]);

  const canAct = waitingForUser && !isOpponentThinking && !isGameOver;

  // ── STT state ─────────────────────────────────────────────────────────────

  const [micActive, setMicActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const micActiveRef = useRef(false);
  useEffect(() => { micActiveRef.current = micActive; }, [micActive]);

  // ── Manual input ──────────────────────────────────────────────────────────

  const [manualText, setManualText] = useState('');

  // ── Touch move state ──────────────────────────────────────────────────────

  const [touchSelected, setTouchSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);

  // Clear touch selection when it's no longer the player's turn
  useEffect(() => {
    if (!canAct) {
      setTouchSelected(null);
      setLegalDests([]);
    }
  }, [canAct]);

  // ── Speech recognition events ──────────────────────────────────────────

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (event: any) => {
    if (event?.isFinal) {
      const results: Array<{ transcript: string }> = event.results ?? [];
      const transcript = results[0]?.transcript ?? '';
      if (transcript) applyRef.current(transcript);
    }
  });
  useSpeechRecognitionEvent('error', () => setIsListening(false));

  // ── Mic helpers ────────────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    try {
      const { granted } =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setHasPermission(granted);
      if (!granted) return;
      ExpoSpeechRecognitionModule.start({
        lang: 'fr-FR',
        interimResults: false,
        maxAlternatives: 4,
      });
    } catch {
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
  }, []);

  // ── Auto-restart mic when toggle is on and it's the player's turn ─────────

  useEffect(() => {
    // Only restart when all three conditions are simultaneously true
    if (!micActive || !canAct || isListening) return;

    const t = setTimeout(() => {
      if (micActiveRef.current) startListening();
    }, 600); // brief pause before re-opening the mic

    return () => clearTimeout(t);
  }, [micActive, canAct, isListening, startListening]);

  // Turn off mic toggle when game is over
  useEffect(() => {
    if (isGameOver && micActive) {
      setMicActive(false);
      stopListening();
    }
  }, [isGameOver, micActive, stopListening]);

  // ── Mic button toggle ─────────────────────────────────────────────────────

  const onMicPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (micActive) {
      // Turn mic OFF
      setMicActive(false);
      stopListening();
    } else {
      // Turn mic ON
      setMicActive(true);
      if (canAct) startListening(); // start immediately if it's our turn
    }
  }, [micActive, canAct, startListening, stopListening]);

  // ── Pulse animation ────────────────────────────────────────────────────────

  const scale = useSharedValue(1);

  useEffect(() => {
    if (isListening) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.09, { duration: 440 }),
          withTiming(1.00, { duration: 440 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(scale);
      scale.value = withTiming(1.0, { duration: 140 });
    }
  }, [isListening, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // ── Manual input submit ────────────────────────────────────────────────────

  const onPlayManual = useCallback(() => {
    const text = manualText.trim();
    if (!text) return;
    applyRef.current(text);
    setManualText('');
  }, [manualText]);

  // ── Touch move handler ────────────────────────────────────────────────────

  const onSquarePress = useCallback(
    (square: string) => {
      if (!canAct) return;

      if (touchSelected === null) {
        // Try to select a piece
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setTouchSelected(square);
          setLegalDests(dests);
        }
      } else if (square === touchSelected) {
        // Tap the selected piece again → deselect
        setTouchSelected(null);
        setLegalDests([]);
      } else if (legalDests.includes(square)) {
        // Execute the move
        movePieceBySquare(touchSelected, square);
        setTouchSelected(null);
        setLegalDests([]);
      } else {
        // Try re-selecting another friendly piece
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setTouchSelected(square);
          setLegalDests(dests);
        } else {
          // Deselect
          setTouchSelected(null);
          setLegalDests([]);
        }
      }
    },
    [canAct, touchSelected, legalDests, getLegalDestinations, movePieceBySquare],
  );

  // ── Color picker handler ───────────────────────────────────────────────────

  const onPickColor = useCallback(
    (color: PlayerColor) => {
      if (color === playerColor) {
        newGame(); // same color → just restart
      } else {
        changeColor(color);
      }
    },
    [playerColor, newGame, changeColor],
  );

  // ── Move history rows ──────────────────────────────────────────────────────

  const moveRows: MoveRow[] = [];
  for (let i = 0; i < history.length; i += 2) {
    moveRows.push({
      key: String(i),
      num: Math.floor(i / 2) + 1,
      white: history[i] ?? '',
      black: history[i + 1] ?? '',
    });
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  const topPad    = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const micBg = micActive
    ? isListening ? '#c0392b' : '#992520'
    : colors.primary;

  const micIcon = micActive
    ? isListening ? 'mic' : 'mic-outline'
    : 'mic-off-outline';

  const micLabel = isListening
    ? 'Écoute…'
    : micActive
    ? 'Micro actif'
    : 'Micro éteint';

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + 6,
          paddingBottom: bottomPad + 6,
        },
      ]}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Échecs à l'oral
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {playerColor === 'w' ? 'Tu joues les Blancs' : 'Tu joues les Noirs'}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={repeatLast}
            testID="repeat-btn"
          >
            <Ionicons name="volume-high-outline" size={20} color={colors.foreground} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={newGame}
            testID="new-game-btn"
          >
            <Ionicons name="refresh-outline" size={20} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      {/* ── Color picker ────────────────────────────────────────────── */}
      <View style={styles.colorRow}>
        <Pressable
          style={({ pressed }) => [
            styles.colorPill,
            {
              backgroundColor:
                playerColor === 'w' ? colors.primary : colors.card,
              borderColor:
                playerColor === 'w' ? colors.primary : colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={() => onPickColor('w')}
          testID="color-white"
        >
          <Text style={[
            styles.colorPillText,
            { color: playerColor === 'w' ? '#fff' : colors.mutedForeground },
          ]}>
            ♔ Blancs
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.colorPill,
            {
              backgroundColor:
                playerColor === 'b' ? colors.primary : colors.card,
              borderColor:
                playerColor === 'b' ? colors.primary : colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={() => onPickColor('b')}
          testID="color-black"
        >
          <Text style={[
            styles.colorPillText,
            { color: playerColor === 'b' ? '#fff' : colors.mutedForeground },
          ]}>
            ♚ Noirs
          </Text>
        </Pressable>
      </View>

      {/* ── Board ──────────────────────────────────────────────────── */}
      <View style={styles.boardRow}>
        <ChessBoard
          board={board}
          lastMove={lastMove}
          isFlipped={playerColor === 'b'}
          selectedSquare={touchSelected}
          legalDots={legalDests}
          onSquarePress={onSquarePress}
        />
      </View>

      {/* ── Status ─────────────────────────────────────────────────── */}
      <View
        style={[
          styles.statusCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text
          numberOfLines={2}
          style={[
            styles.statusText,
            {
              color: isGameOver
                ? '#ffcf70'
                : isOpponentThinking
                ? colors.mutedForeground
                : colors.foreground,
            },
          ]}
        >
          {isOpponentThinking ? "L'adversaire réfléchit…" : status}
        </Text>
        {!!heardText && (
          <Text numberOfLines={1} style={[styles.heardText, { color: '#a9d6ff' }]}>
            Entendu : {heardText}
          </Text>
        )}
      </View>

      {/* ── Mic toggle button ───────────────────────────────────────── */}
      <View style={styles.micRow}>
        <Animated.View style={animStyle}>
          <Pressable
            onPress={onMicPress}
            testID="mic-btn"
            style={({ pressed }) => [
              styles.micBtn,
              {
                backgroundColor: micBg,
                opacity: pressed ? 0.80 : 1,
              },
            ]}
          >
            <Ionicons name={micIcon as any} size={22} color="#fff" />
            <Text style={styles.micLabel}>{micLabel}</Text>
          </Pressable>
        </Animated.View>
        {hasPermission === false && (
          <Text style={[styles.permWarn, { color: '#ffcf70' }]}>
            Permission microphone refusée
          </Text>
        )}
      </View>

      {/* ── Manual input ───────────────────────────────────────────── */}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.input,
              color: colors.foreground,
              borderColor: colors.border,
            },
          ]}
          value={manualText}
          onChangeText={setManualText}
          placeholder="Ex. Fou b5, e4, petit roque…"
          placeholderTextColor={colors.mutedForeground}
          onSubmitEditing={onPlayManual}
          returnKeyType="send"
          editable={canAct}
          testID="manual-input"
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: colors.accent, opacity: pressed ? 0.72 : 1 },
          ]}
          onPress={onPlayManual}
          testID="send-btn"
        >
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* ── Move history ───────────────────────────────────────────── */}
      <View
        style={[
          styles.historyCard,
          { flex: 1, backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.historyTitle, { color: colors.foreground }]}>
          Coups joués
        </Text>
        {moveRows.length === 0 ? (
          <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
            La partie commence ici
          </Text>
        ) : (
          <FlatList
            data={moveRows}
            keyExtractor={item => item.key}
            scrollEnabled={!!moveRows.length}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View
                style={[styles.moveRow, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.moveNum, { color: colors.mutedForeground }]}>
                  {item.num}.
                </Text>
                <Text style={[styles.moveCell, { color: colors.foreground }]}>
                  {item.white}
                </Text>
                <Text style={[styles.moveCell, { color: colors.mutedForeground }]}>
                  {item.black}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 10,
    gap: 7,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Color picker
  colorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorPill: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPillText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  // Board
  boardRow: {
    alignItems: 'center',
  },
  // Status
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 48,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
  },
  heardText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
  },
  // Mic
  micRow: {
    alignItems: 'center',
    gap: 5,
  },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  micLabel: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  permWarn: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  // Input
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // History
  historyCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 8,
    minHeight: 70,
  },
  historyTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyMsg: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingVertical: 6,
  },
  moveRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  moveNum: {
    width: 28,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  moveCell: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
