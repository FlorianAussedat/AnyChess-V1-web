import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useColors } from '@/hooks/useColors';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { ChessBoard } from '@/components/ChessBoard';
import { BoardVisibilityToggle } from '@/components/BoardVisibilityToggle';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { SoundToggle } from '@/components/SoundToggle';
import { HiddenBoardPlaceholder } from '@/components/HiddenBoardPlaceholder';
import { TheoryContinuationViewer } from '@/components/TheoryContinuationViewer';
import { OpeningIdentityBadge } from '@/components/OpeningIdentityBadge';
import { useOpeningGame } from '@/contexts/OpeningGameContext';
import type { PlayerColor } from '@/contexts/OpeningGameContext';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { sfxService } from '@/services/SfxService';
import { useOpeningIdentity } from '@/hooks/useOpeningIdentity';
import { BrandAssets } from '@/constants/BrandAssets';

type MoveRow = { key: string; num: number; white: string; black: string };
type SideChoice = 'w' | 'b' | 'random';

export function OpeningGameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  useCancelSpeechOnLeave('/openings/play');

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
    phase,
    theoryExit,
    repertoireName,
    ready,
    loadError,
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
  } = useOpeningGame();

  const openingIdentity = useOpeningIdentity(history);

  const applyRef = useRef(applyUserMove);
  useEffect(() => {
    applyRef.current = applyUserMove;
  }, [applyUserMove]);

  const canAct = waitingForUser && !isOpponentThinking && !isGameOver;
  const gameStarted = history.length > 0;
  const [pendingSide, setPendingSide] = useState<SideChoice>(
    () => (playerColor === 'b' ? 'b' : 'w'),
  );
  const [boardVisible, setBoardVisible] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [theoryOpen, setTheoryOpen] = useState(false);
  const [exportedText, setExportedText] = useState('');
  const prevGameOver = useRef(false);

  useEffect(() => {
    if (isGameOver && !prevGameOver.current) {
      setExportOpen(true);
      setExportedText(exportPgn());
    }
    prevGameOver.current = isGameOver;
  }, [isGameOver, exportPgn]);

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

  const [touchSelected, setTouchSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);

  useEffect(() => {
    if (!canAct) {
      setTouchSelected(null);
      setLegalDests([]);
    }
  }, [canAct]);

  const onMicPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleMic();
  }, [toggleMic]);

  const scale = useSharedValue(1);
  useEffect(() => {
    if (isListening) {
      scale.value = withRepeat(
        withSequence(withTiming(1.09, { duration: 440 }), withTiming(1.0, { duration: 440 })),
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

  const onSquarePress = useCallback(
    (square: string) => {
      if (!canAct) return;
      if (touchSelected === null) {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setTouchSelected(square);
          setLegalDests(dests);
        }
      } else if (square === touchSelected) {
        setTouchSelected(null);
        setLegalDests([]);
      } else if (legalDests.includes(square)) {
        movePieceBySquare(touchSelected, square);
        setTouchSelected(null);
        setLegalDests([]);
      } else {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setTouchSelected(square);
          setLegalDests(dests);
        } else {
          setTouchSelected(null);
          setLegalDests([]);
        }
      }
    },
    [canAct, touchSelected, legalDests, getLegalDestinations, movePieceBySquare],
  );

  const onPickSide = useCallback(
    (side: SideChoice) => {
      if (gameStarted) return;
      setPendingSide(side);
      const color: PlayerColor =
        side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
      if (color === playerColor) newGame();
      else changeColor(color);
    },
    [gameStarted, playerColor, newGame, changeColor],
  );

  const onNewGamePress = useCallback(() => {
    if (pendingSide === 'random') {
      const color: PlayerColor = Math.random() < 0.5 ? 'w' : 'b';
      if (color === playerColor) newGame();
      else changeColor(color);
    } else if (pendingSide !== playerColor) {
      changeColor(pendingSide);
    } else {
      newGame();
    }
  }, [pendingSide, playerColor, newGame, changeColor]);

  const moveRows: MoveRow[] = [];
  for (let i = 0; i < history.length; i += 2) {
    moveRows.push({
      key: String(i),
      num: Math.floor(i / 2) + 1,
      white: history[i] ?? '',
      black: history[i + 1] ?? '',
    });
  }

  const historyListRef = useRef<FlatList<MoveRow>>(null);
  useEffect(() => {
    if (moveRows.length > 0) {
      setTimeout(() => historyListRef.current?.scrollToEnd({ animated: true }), 60);
    }
  }, [moveRows.length]);

  let micBg: string;
  let micIconName: string;
  let micLabel: string;
  if (showRecognized) {
    micBg = '#27AE60';
    micIconName = 'checkmark-circle';
    micLabel = 'Coup reconnu';
  } else if (isListening) {
    micBg = '#C0392B';
    micIconName = 'mic';
    micLabel = "J'écoute…";
  } else if (micActive) {
    micBg = '#D4880A';
    micIconName = 'mic-outline';
    micLabel = 'Micro actif';
  } else {
    micBg = colors.primary;
    micIconName = 'mic-off-outline';
    micLabel = 'Parler';
  }

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  if (loadError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 6 }]}>
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.errorText, { color: colors.destructive }]}>{loadError}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 6, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: 'Inter_400Regular' }}>
          Chargement du répertoire…
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: topPad + 6, paddingBottom: bottomPad + 6 },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {repertoireName}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {playerColor === 'w' ? 'Tu joues les Blancs' : 'Tu joues les Noirs'}
              {' · '}
              {phase === 'book' ? 'Théorie' : 'Stockfish'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {gameStarted && (
            <Image
              source={playerColor === 'w' ? BrandAssets.sides.white : BrandAssets.sides.black}
              style={styles.sideIndicator}
              accessibilityLabel={playerColor === 'w' ? 'Blancs' : 'Noirs'}
            />
          )}
          <SoundToggle />
          <BoardCoordinatesToggle
            visible={showCoordinates}
            onToggle={() => { void toggleCoordinates(); }}
          />
          <BoardVisibilityToggle visible={boardVisible} onToggle={() => setBoardVisible((v) => !v)} />
        </View>
      </View>

      {theoryExit && (
        <View
          style={[
            styles.theoryBanner,
            {
              backgroundColor: theoryExit.kind === 'player-deviation' ? '#3A2A10' : colors.card,
              borderColor: theoryExit.kind === 'player-deviation' ? '#F5A623' : colors.border,
            },
          ]}
        >
          <Text style={[styles.theoryText, { color: colors.foreground }]} numberOfLines={2}>
            {theoryExit.message}
          </Text>
          {theoryExit.kind === 'player-deviation' && theoryExit.analysis && (
            <Pressable onPress={() => setTheoryOpen(true)} hitSlop={6}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 }}>
                Voir la ligne théorique
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          onPress={repeatLast}
        >
          <Ionicons name="volume-medium-outline" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnLabel, { color: colors.foreground }]}>Répéter</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          onPress={undoMove}
        >
          <Ionicons name="arrow-undo-outline" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnLabel, { color: colors.foreground }]}>Annuler</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          onPress={summarizeGame}
        >
          <Ionicons name="list-outline" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnLabel, { color: colors.foreground }]}>Résumé</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          onPress={onNewGamePress}
        >
          <Ionicons name="refresh-outline" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnLabel, { color: colors.foreground }]} numberOfLines={2}>
            Nouvelle{'\n'}partie
          </Text>
        </Pressable>
      </View>

      {!gameStarted ? (
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
      ) : null}

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
          {isOpponentThinking
            ? phase === 'book'
              ? 'Répertoire…'
              : "L'adversaire réfléchit…"
            : status}
        </Text>
        {!!heardText && (
          <Text numberOfLines={1} style={[styles.heardText, { color: '#7BC8FF' }]}>
            Entendu : {heardText}
          </Text>
        )}
      </View>

      <View style={styles.micRow}>
        <Animated.View style={animStyle}>
          <Pressable
            onPress={onMicPress}
            style={({ pressed }) => [styles.micBtn, { backgroundColor: micBg, opacity: pressed ? 0.82 : 1 }]}
          >
            <Ionicons name={micIconName as any} size={22} color="#fff" />
            <Text style={styles.micLabel}>{micLabel}</Text>
          </Pressable>
        </Animated.View>
        {!!micStatus.message && (
          <Text style={[styles.permWarn, { color: '#F5A623' }]}>{micStatus.message}</Text>
        )}
      </View>

      <ChessAnswerInput
        onSubmit={onPlayManual}
        enabled={canAct}
        persistFocus={canAct}
        placeholder="Ex. e4, Cf3, petit roque…"
        testID="opening-manual-input"
      />

      <View
        style={[
          styles.historyCard,
          { flex: 1, backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.historyHeader}>
          <View style={{ flex: 1, gap: 2, paddingRight: 8 }}>
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
            >
              <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                Exporter
              </Text>
            </Pressable>
          )}
        </View>
        {moveRows.length === 0 ? (
          <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
            L’adversaire suit ton répertoire
          </Text>
        ) : (
          <FlatList
            ref={historyListRef}
            data={moveRows}
            keyExtractor={(item) => item.key}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={[styles.moveRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.moveNum, { color: colors.mutedForeground }]}>{item.num}.</Text>
                <Text style={[styles.moveCell, { color: colors.foreground }]}>{item.white}</Text>
                <Text style={[styles.moveCell, { color: colors.mutedForeground }]}>{item.black}</Text>
              </View>
            )}
          />
        )}
      </View>

      <TheoryContinuationViewer
        visible={theoryOpen}
        analysis={theoryExit?.analysis ?? null}
        onClose={() => setTheoryOpen(false)}
      />

      <Modal visible={exportOpen} transparent animationType="fade" onRequestClose={() => setExportOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Exporter la partie en PGN ?
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Inclut les coups, le résultat, ta couleur, le répertoire
              {theoryExit ? ' et le commentaire de sortie de théorie' : ''}.
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

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 10, gap: 7 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, marginRight: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  theoryBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  theoryText: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 17 },
  actionRow: { flexDirection: 'row', gap: 6 },
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
  colorRow: { flexDirection: 'row', gap: 8 },
  sidePill: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 6,
  },
  sidePillIcon: { width: 22, height: 22 },
  sideIndicator: { width: 28, height: 28, borderRadius: 6 },
  colorPillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  boardRow: { alignItems: 'center' },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 46,
    justifyContent: 'center',
  },
  statusText: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  heardText: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
  micRow: { alignItems: 'center', gap: 5 },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  micLabel: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  permWarn: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  inputRow: { flexDirection: 'row', gap: 8 },
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
    alignItems: 'center',
    marginBottom: 4,
  },
  historyTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
  moveNum: { width: 28, fontSize: 12, fontFamily: 'Inter_400Regular' },
  moveCell: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  errorText: {
    marginTop: 24,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingHorizontal: 20,
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
    gap: 12,
  },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  modalBody: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
