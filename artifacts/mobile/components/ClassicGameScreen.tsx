import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useColors } from '@/hooks/useColors';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { ChessBoard } from '@/components/ChessBoard';
import { BoardVisibilityToggle } from '@/components/BoardVisibilityToggle';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { SoundToggle } from '@/components/SoundToggle';
import { HiddenBoardPlaceholder } from '@/components/HiddenBoardPlaceholder';
import { OpeningIdentityBadge } from '@/components/OpeningIdentityBadge';
import { useGame } from '@/contexts/GameContext';
import type { PlayerColor } from '@/contexts/GameContext';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useOpeningIdentity } from '@/hooks/useOpeningIdentity';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { BrandAssets } from '@/constants/BrandAssets';

// ── Types ──────────────────────────────────────────────────────────────────

type MoveRow = { key: string; num: number; white: string; black: string };

// ── Screen ─────────────────────────────────────────────────────────────────

export function ClassicGameScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const isWeb   = Platform.OS === 'web';
  const { soundEnabled } = useAudioSettings();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();

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
    moveEvent,
    isSpeaking,
    applyUserMove,
    movePieceBySquare,
    getLegalDestinations,
    newGame,
    changeColor,
    repeatLast,
    summarizeGame,
    undoMove,
    exportPgn,
    downloadPgn,
  } = useGame();

  const openingIdentity = useOpeningIdentity(history);

  // Stable ref so STT handlers never close over stale values
  const applyRef = useRef(applyUserMove);
  useEffect(() => { applyRef.current = applyUserMove; }, [applyUserMove]);

  const canAct     = waitingForUser && !isOpponentThinking && !isGameOver;
  const gameStarted = history.length > 0;

  // ── Board visibility (eye toggle) ─────────────────────────────────────────
  const [boardVisible, setBoardVisible] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportedText, setExportedText] = useState('');

  // ── Speech input (shared service) ─────────────────────────────────────────
  const {
    micActive,
    isListening,
    status: micStatus,
    toggleMic,
  } = useSpeechInput({
    isSpeaking,
    forceOff: isGameOver,
    onTranscript: (text) => applyRef.current(text),
  });

  // ── Sound effects ─────────────────────────────────────────────────────────

  const successSoundRef = useRef<Audio.Sound | null>(null);
  const errorSoundRef   = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadSounds() {
      try {
        const { sound: s1 } = await Audio.Sound.createAsync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('@/assets/sounds/success.wav'),
          { volume: 0.6 },
        );
        const { sound: s2 } = await Audio.Sound.createAsync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('@/assets/sounds/error.wav'),
          { volume: 0.5 },
        );
        if (mounted) {
          successSoundRef.current = s1;
          errorSoundRef.current   = s2;
        } else {
          s1.unloadAsync().catch(() => {});
          s2.unloadAsync().catch(() => {});
        }
      } catch {
        /* sounds are non-critical — fail silently */
      }
    }
    loadSounds();
    return () => {
      mounted = false;
      successSoundRef.current?.unloadAsync().catch(() => {});
      errorSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ── Audio session initialisation ──────────────────────────────────────────

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    }).catch(() => {});
  }, []);

  // ── Haptics + sound on move success / error ───────────────────────────────

  const [showRecognized, setShowRecognized] = useState(false);
  const recognizedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!moveEvent) return;
    if (moveEvent.kind === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (soundEnabled) successSoundRef.current?.replayAsync().catch(() => {});
      setShowRecognized(true);
      if (recognizedTimerRef.current) clearTimeout(recognizedTimerRef.current);
      recognizedTimerRef.current = setTimeout(() => setShowRecognized(false), 1500);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (soundEnabled) errorSoundRef.current?.replayAsync().catch(() => {});
    }
  }, [moveEvent?.id, soundEnabled]);

  // ── Touch move state ──────────────────────────────────────────────────────

  const [touchSelected, setTouchSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests]       = useState<string[]>([]);

  useEffect(() => {
    if (!canAct) { setTouchSelected(null); setLegalDests([]); }
  }, [canAct]);

  const onMicPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleMic();
  }, [toggleMic]);

  // ── Pulse animation ───────────────────────────────────────────────────────

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

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPlayManual = useCallback((text: string) => {
    applyRef.current(text);
  }, []);

  // ── Touch move handler ────────────────────────────────────────────────────

  const onSquarePress = useCallback(
    (square: string) => {
      if (!canAct) return;
      if (touchSelected === null) {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) { setTouchSelected(square); setLegalDests(dests); }
      } else if (square === touchSelected) {
        setTouchSelected(null); setLegalDests([]);
      } else if (legalDests.includes(square)) {
        movePieceBySquare(touchSelected, square);
        setTouchSelected(null); setLegalDests([]);
      } else {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) { setTouchSelected(square); setLegalDests(dests); }
        else { setTouchSelected(null); setLegalDests([]); }
      }
    },
    [canAct, touchSelected, legalDests, getLegalDestinations, movePieceBySquare],
  );

  // ── Color picker — locked once game has started ───────────────────────────

  const onPickColor = useCallback(
    (color: PlayerColor) => {
      if (gameStarted) return;
      if (color === playerColor) newGame();
      else changeColor(color);
    },
    [gameStarted, playerColor, newGame, changeColor],
  );

  // ── Move history rows ─────────────────────────────────────────────────────

  const moveRows: MoveRow[] = [];
  for (let i = 0; i < history.length; i += 2) {
    moveRows.push({
      key: String(i),
      num: Math.floor(i / 2) + 1,
      white: history[i]  ?? '',
      black: history[i + 1] ?? '',
    });
  }

  // Auto-scroll to latest move
  const historyListRef = useRef<FlatList<MoveRow>>(null);
  useEffect(() => {
    if (moveRows.length > 0) {
      setTimeout(() => historyListRef.current?.scrollToEnd({ animated: true }), 60);
    }
  }, [moveRows.length]);

  // ── Mic button — 4 visual states ──────────────────────────────────────────

  let micBg: string;
  let micLabel: string;

  if (showRecognized) {
    micBg       = '#27AE60';
    micLabel    = 'Coup reconnu';
  } else if (isListening) {
    micBg       = '#C0392B';
    micLabel    = "J'écoute…";
  } else if (micActive) {
    micBg       = '#D4880A';
    micLabel    = 'Micro actif';
  } else {
    micBg       = colors.primary;
    micLabel    = 'Parler';
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  const topPad    = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: topPad + 6, paddingBottom: bottomPad + 6 },
      ]}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 }]}
            testID="back-btn"
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <Image source={BrandAssets.logoMark} style={styles.logoImg} />
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Partie classique</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {playerColor === 'w' ? 'Tu joues les Blancs' : 'Tu joues les Noirs'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <SoundToggle />
          <BoardCoordinatesToggle
            visible={showCoordinates}
            onToggle={() => { void toggleCoordinates(); }}
          />
          <BoardVisibilityToggle
            visible={boardVisible}
            onToggle={() => setBoardVisible((v) => !v)}
          />
        </View>
      </View>

      {/* ── Action row ───────────────────────────────────────────────────── */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          onPress={repeatLast}
          testID="repeat-btn"
        >
          <Ionicons name="volume-medium-outline" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnLabel, { color: colors.foreground }]}>Répéter</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          onPress={undoMove}
          testID="undo-btn"
        >
          <Ionicons name="arrow-undo-outline" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnLabel, { color: colors.foreground }]}>Annuler</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          onPress={summarizeGame}
          testID="summary-btn"
        >
          <Ionicons name="list-outline" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnLabel, { color: colors.foreground }]}>Résumé</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          onPress={newGame}
          testID="new-game-btn"
        >
          <Ionicons name="refresh-outline" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnLabel, { color: colors.foreground }]} numberOfLines={2}>
            Nouvelle{'\n'}partie
          </Text>
        </Pressable>
      </View>

      {/* ── Color picker — locked when game has started ──────────────── */}
      <View style={styles.colorRow}>
        {(['w', 'b'] as PlayerColor[]).map((c) => {
          const active = playerColor === c;
          const locked = gameStarted;
          return (
            <Pressable
              key={c}
              style={[
                styles.colorPill,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor:     active ? colors.primary : colors.border,
                  opacity:         locked && !active ? 0.45 : 1,
                },
              ]}
              onPress={() => onPickColor(c)}
              disabled={locked && !active}
              testID={c === 'w' ? 'color-white' : 'color-black'}
            >
              <Image
                source={c === 'w' ? BrandAssets.sides.white : BrandAssets.sides.black}
                style={styles.sideIcon}
                resizeMode="contain"
              />
              <Text style={[styles.colorPillText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                {c === 'w' ? 'Blancs' : 'Noirs'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Board (hidden by the eye toggle without touching game state) ── */}
      <View style={styles.boardRow}>
        {boardVisible ? (
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={playerColor === 'b'}
            selectedSquare={touchSelected}
            legalDots={legalDests}
            onSquarePress={onSquarePress}
            showCoordinates={showCoordinates}
          />
        ) : (
          <HiddenBoardPlaceholder onReveal={() => setBoardVisible(true)} />
        )}
      </View>

      {/* ── Status ──────────────────────────────────────────────────────── */}
      <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text
          numberOfLines={2}
          style={[
            styles.statusText,
            {
              color: isGameOver
                ? '#F5A623'
                : isOpponentThinking
                ? colors.mutedForeground
                : colors.foreground,
            },
          ]}
        >
          {isOpponentThinking ? "L'adversaire réfléchit…" : status}
        </Text>
        {!!heardText && (
          <Text numberOfLines={1} style={[styles.heardText, { color: '#7BC8FF' }]}>
            Entendu : {heardText}
          </Text>
        )}
      </View>

      {/* ── Mic toggle button ────────────────────────────────────────────── */}
      <View style={styles.micRow}>
        <Animated.View style={animStyle}>
          <Pressable
            onPress={onMicPress}
            testID="mic-btn"
            style={({ pressed }) => [styles.micBtn, { backgroundColor: micBg, opacity: pressed ? 0.82 : 1 }]}
          >
            {showRecognized ? (
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
            ) : (
              <Image
                source={micActive || isListening ? BrandAssets.toggles.micOn : BrandAssets.toggles.micOff}
                style={styles.micBrandIcon}
                resizeMode="contain"
              />
            )}
            <Text style={styles.micLabel}>{micLabel}</Text>
          </Pressable>
        </Animated.View>
        {!!micStatus.message && (
          <Text style={[styles.permWarn, { color: '#F5A623' }]}>
            {micStatus.message}
          </Text>
        )}
      </View>

      {/* ── Manual text input ────────────────────────────────────────────── */}
      <ChessAnswerInput
        onSubmit={onPlayManual}
        enabled={canAct}
        persistFocus={canAct}
        placeholder="Ex. Nc3, Fou b5, e4, petit roque, annuler…"
        testID="manual-input"
      />

      {/* ── Move history ─────────────────────────────────────────────────── */}
      <View style={[styles.historyCard, { flex: 1, backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.historyHeader}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.historyTitle, { color: colors.mutedForeground }]}>Coups joués</Text>
            <OpeningIdentityBadge opening={openingIdentity} />
          </View>
          {history.length > 0 && (
            <Pressable
              onPress={() => {
                setExportedText(exportPgn());
                setExportOpen(true);
              }}
              hitSlop={8}
              accessibilityLabel="Exporter en PGN"
              style={({ pressed }) => [
                styles.exportIconBtn,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="download-outline" size={16} color={colors.foreground} />
            </Pressable>
          )}
        </View>
        {moveRows.length === 0 ? (
          <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
            La partie commence ici
          </Text>
        ) : (
          <FlatList
            ref={historyListRef}
            data={moveRows}
            keyExtractor={item => item.key}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={[styles.moveRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.moveNum,  { color: colors.mutedForeground }]}>{item.num}.</Text>
                <Text style={[styles.moveCell, { color: colors.foreground }]}>{item.white}</Text>
                <Text style={[styles.moveCell, { color: colors.mutedForeground }]}>{item.black}</Text>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={exportOpen} transparent animationType="fade" onRequestClose={() => setExportOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Exporter la partie en PGN ?
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Inclut les coups, le résultat, ta couleur, Stockfish
              {openingIdentity ? `, l’ouverture (${openingIdentity.name}) et le code ECO` : ''}.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setExportOpen(false)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>Non</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (isWeb) downloadPgn();
                  else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(exportedText || exportPgn()).catch(() => {});
                  }
                  setExportOpen(false);
                }}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                  Oui
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  sideIcon: {
    width: 28,
    height: 28,
  },
  micBrandIcon: {
    width: 22,
    height: 22,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  // Action row
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 44,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    flexShrink: 1,
  },
  // Color picker
  colorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
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
    minHeight: 46,
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
    paddingVertical: 13,
    paddingHorizontal: 32,
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
    minHeight: 60,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  historyTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  exportIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMsg: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingVertical: 6,
  },
  moveRow: {
    flexDirection: 'row',
    paddingVertical: 4,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  modalBody: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  modalBtn: {
    minWidth: 72,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
});
