import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { useColors } from '@/hooks/useColors';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
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
import { sfxService } from '@/services/SfxService';
import { useOpeningIdentity } from '@/hooks/useOpeningIdentity';
import { BrandAssets } from '@/constants/BrandAssets';
import {
  DEFAULT_STRENGTH_BAND_ID,
  STOCKFISH_STRENGTH_BANDS,
} from '@/lib/difficulty/StockfishStrengthBands';

// ── Types ──────────────────────────────────────────────────────────────────

type MoveRow = { key: string; num: number; white: string; black: string };
type SideChoice = 'w' | 'b' | 'random';

// ── Screen ─────────────────────────────────────────────────────────────────

export function ClassicGameScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const isWeb   = Platform.OS === 'web';
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  useCancelSpeechOnLeave('/classic');

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
    strengthBandId,
    setStrengthBandId,
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
  const [pendingSide, setPendingSide] = useState<SideChoice>(
    () => (playerColor === 'b' ? 'b' : 'w'),
  );
  const [setupBandId, setSetupBandId] = useState(strengthBandId || DEFAULT_STRENGTH_BAND_ID);

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

  // ── Haptics + SFX on move success / error (SFX independent of voice mute) ──

  const [showRecognized, setShowRecognized] = useState(false);
  const recognizedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!moveEvent) return;
    if (moveEvent.kind === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void sfxService.playSuccess();
      setShowRecognized(true);
      if (recognizedTimerRef.current) clearTimeout(recognizedTimerRef.current);
      recognizedTimerRef.current = setTimeout(() => setShowRecognized(false), 1500);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      void sfxService.playError();
    }
  }, [moveEvent?.id]);

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

  // ── Pre-game setup: side + strength ───────────────────────────────────────

  const onPickSetupBand = useCallback(
    (id: string) => {
      if (gameStarted) return;
      setSetupBandId(id);
      setStrengthBandId(id);
    },
    [gameStarted, setStrengthBandId],
  );

  const onPickSide = useCallback(
    (side: SideChoice) => {
      if (gameStarted) return;
      setPendingSide(side);
      setStrengthBandId(setupBandId);
      const color: PlayerColor =
        side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
      if (color === playerColor) newGame();
      else changeColor(color);
    },
    [gameStarted, setupBandId, setStrengthBandId, playerColor, newGame, changeColor],
  );

  const onNewGamePress = useCallback(() => {
    setStrengthBandId(setupBandId);
    if (pendingSide === 'random') {
      const color: PlayerColor = Math.random() < 0.5 ? 'w' : 'b';
      if (color === playerColor) newGame();
      else changeColor(color);
    } else if (pendingSide !== playerColor) {
      changeColor(pendingSide);
    } else {
      newGame();
    }
  }, [setupBandId, setStrengthBandId, pendingSide, playerColor, newGame, changeColor]);

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
  let micIconName: string;
  let micLabel: string;

  if (showRecognized) {
    micBg       = '#27AE60';
    micIconName = 'checkmark-circle';
    micLabel    = 'Coup reconnu';
  } else if (isListening) {
    micBg       = '#C0392B';
    micIconName = 'mic';
    micLabel    = "J'écoute…";
  } else if (micActive) {
    micBg       = '#D4880A';
    micIconName = 'mic-outline';
    micLabel    = 'Micro actif';
  } else {
    micBg       = colors.primary;
    micIconName = 'mic-off-outline';
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
          <Image source={require('@/assets/images/icon.png')} style={styles.logoImg} />
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Partie classique</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {playerColor === 'w' ? 'Tu joues les Blancs' : 'Tu joues les Noirs'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {gameStarted && (
            <View
              style={styles.sideIndicator}
              accessibilityLabel={playerColor === 'w' ? 'Blancs' : 'Noirs'}
            >
              <Image source={BrandAssets.logoMark} style={styles.sideIndicatorMark} resizeMode="contain" />
              <Text
                style={[
                  styles.sideIndicatorLetter,
                  { color: playerColor === 'w' ? '#F5F5F5' : '#1A1A1A' },
                ]}
              >
                {playerColor === 'w' ? 'B' : 'N'}
              </Text>
            </View>
          )}
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
          onPress={onNewGamePress}
          testID="new-game-btn"
        >
          <Ionicons name="refresh-outline" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnLabel, { color: colors.foreground }]} numberOfLines={2}>
            Nouvelle{'\n'}partie
          </Text>
        </Pressable>
      </View>

      {/* ── Pre-game setup (hidden once the game has started) ──────────── */}
      {!gameStarted ? (
        <View style={styles.setupBlock}>
          <Text style={[styles.setupLabel, { color: colors.mutedForeground }]}>Tu joues :</Text>
          <View style={styles.colorRow}>
            {(
              [
                { id: 'w' as SideChoice, label: 'Blancs', icon: BrandAssets.sides.white },
                { id: 'b' as SideChoice, label: 'Noirs', icon: BrandAssets.sides.black },
                { id: 'random' as SideChoice, label: 'Aléatoire', icon: BrandAssets.sides.random },
              ] as const
            ).map((opt) => {
              const active = pendingSide === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.sidePill,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => onPickSide(opt.id)}
                  testID={
                    opt.id === 'w'
                      ? 'color-white'
                      : opt.id === 'b'
                        ? 'color-black'
                        : 'color-random'
                  }
                >
                  <Image source={opt.icon} style={styles.sidePillIcon} />
                  <Text
                    style={[
                      styles.colorPillText,
                      { color: active ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.setupLabel, { color: colors.mutedForeground }]}>
            Niveau adversaire
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bandRow}
          >
            {STOCKFISH_STRENGTH_BANDS.map((band) => {
              const active = setupBandId === band.id;
              return (
                <Pressable
                  key={band.id}
                  onPress={() => onPickSetupBand(band.id)}
                  style={[
                    styles.bandChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 11,
                      color: active ? colors.primaryForeground : colors.foreground,
                    }}
                  >
                    {band.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

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
            <Ionicons name={micIconName as any} size={22} color="#fff" />
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
  sideIndicator: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sideIndicatorMark: {
    ...StyleSheet.absoluteFillObject,
    width: 32,
    height: 32,
    opacity: 0.9,
  },
  sideIndicatorLetter: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  setupBlock: {
    gap: 6,
  },
  setupLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Color / side picker
  colorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sidePill: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  sidePillIcon: {
    width: 48,
    height: 48,
  },
  colorPillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  bandRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  bandChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
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
