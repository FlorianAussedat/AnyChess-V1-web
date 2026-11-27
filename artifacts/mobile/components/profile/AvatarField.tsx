import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type ImageSourcePropType,
} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import {
  prepareAvatarImage,
  prepareAvatarSource,
  zoomFromTrack,
  type AvatarPrepareError,
} from '@/lib/profile/avatarImage';
import {
  avatarCropPreview,
  CENTERED_AVATAR,
  clampAvatarPosition,
  clampAvatarZoom,
  panAvatarPosition,
  type AvatarPosition,
} from '@/lib/profile/avatarCrop';
import type { PickedProfileImage } from '@/lib/profile/pickProfileImage';
import { ANYCHESS_MASCOTS } from '@/lib/profile/mascotCatalog';
import { ProfileAvatar } from './ProfileAvatar';

async function defaultPickImage(): Promise<PickedProfileImage | null> {
  const { pickProfileImage } = await import('@/lib/profile/pickProfileImage');
  return pickProfileImage();
}
const PREVIEW_MAX_HEIGHT = 220;
type SaveOutcome = void | 'failed' | 'sync_failed' | 'cancelled';
type Props = {
  username: string | null;
  imageUri: string | null;
  onChange: (
    dataUrl: string | null,
    context?: { cancelled: () => boolean; mascotId?: string },
  ) => SaveOutcome | Promise<SaveOutcome>;
  children?: ReactNode;
  testID?: string;
  imageSource?: ImageSourcePropType | null;
  pickImage?: () => Promise<PickedProfileImage | null>;
  prepareImage?: typeof prepareAvatarImage;
  prepareSource?: typeof prepareAvatarSource;
  mascotSource?: (id: string) => ImageSourcePropType | null;
};

export function AvatarField({
  username,
  imageUri,
  onChange,
  children,
  testID = 'avatar-field',
  imageSource = null,
  pickImage = defaultPickImage,
  prepareImage = prepareAvatarImage,
  prepareSource = prepareAvatarSource,
  mascotSource,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [step, setStep] = useState<'closed' | 'choice' | 'gallery'>('closed');
  const [selectedMascot, setSelectedMascot] = useState<string | null>(null);
  const [sources, setSources] = useState<Record<string, ImageSourcePropType>>(
    {},
  );
  const [view, setView] = useState({ zoom: 1, position: CENTERED_AVATAR });
  const viewRef = useRef(view);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<
    'reading' | 'processing' | 'saving' | null
  >(null);
  const phaseRef = useRef(phase);
  const [cropError, setCropError] = useState<AvatarPrepareError | null>(null);
  const [saveError, setSaveError] = useState<'failed' | 'sync_failed' | null>(
    null,
  );
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [frameWidth, setFrameWidth] = useState(280);
  const [trackWidth, setTrackWidth] = useState(1);
  const sessionRef = useRef(0);
  const dismissRef = useRef<() => void>(() => {});
  const dragRef = useRef<{
    x: number;
    y: number;
    position: AvatarPosition;
  } | null>(null);
  const busy = phase !== null;
  const frameSide = Math.min(frameWidth, PREVIEW_MAX_HEIGHT);
  const preview = imageSize
    ? avatarCropPreview(
        imageSize.width,
        imageSize.height,
        frameSide,
        view.zoom,
        view.position,
      )
    : null;

  const changePhase = (next: typeof phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const changeView = (zoom: number, position = viewRef.current.position) => {
    const next = {
      zoom: clampAvatarZoom(zoom),
      position: imageSize
        ? clampAvatarPosition(imageSize.width, imageSize.height, zoom, position)
        : position,
    };
    viewRef.current = next;
    setView(next);
  };
  const dismiss = () => {
    // Once durable saving starts, finish it before allowing dismissal. Processing remains cancellable.
    if (phaseRef.current === 'saving') return;
    sessionRef.current++;
    setDragging(false);
    changePhase(null);
    setCropError(null);
    setPickedUri(null);
    setImageSize(null);
    changeView(1, CENTERED_AVATAR);
    setStep('closed');
    setSelectedMascot(null);
  };
  dismissRef.current = dismiss;
  const dialogOpen = step !== 'closed' || pickedUri != null;
  useEffect(
    () => () => {
      sessionRef.current++;
    },
    [],
  );
  useEffect(() => {
    if (!dialogOpen) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        dismissRef.current();
        return true;
      },
    );
    return () => subscription.remove();
  }, [dialogOpen]);

  const save = async (dataUrl: string | null, mascotId?: string) => {
    const id = sessionRef.current;
    changePhase('saving');
    setSaveError(null);
    try {
      const outcome = await onChange(dataUrl, {
        cancelled: () => sessionRef.current !== id,
        mascotId,
      });
      if (sessionRef.current !== id || outcome === 'cancelled') return false;
      if (outcome === 'failed') {
        setSaveError('failed');
        return false;
      }
      setSaveError(outcome === 'sync_failed' ? 'sync_failed' : null);
      return true;
    } catch {
      if (sessionRef.current === id) setSaveError('failed');
      return false;
    } finally {
      if (sessionRef.current === id) changePhase(null);
    }
  };
  const openGallery = async () => {
    if (phaseRef.current) return;
    const id = sessionRef.current;
    changePhase('reading');
    setSaveError(null);
    try {
      const resolve =
        mascotSource ?? (await import('./mascotImages')).mascotImage;
      const next: Record<string, ImageSourcePropType> = {};
      for (const mascot of ANYCHESS_MASCOTS) {
        const source = resolve(mascot.id);
        if (source) next[mascot.id] = source;
      }
      if (sessionRef.current !== id) return;
      setSources(next);
      setStep('gallery');
    } catch {
      if (sessionRef.current === id) setSaveError('failed');
    } finally {
      if (sessionRef.current === id) changePhase(null);
    }
  };
  const confirmMascot = async () => {
    if (!selectedMascot || phaseRef.current) return;
    if (await save(null, selectedMascot)) {
      setStep('closed');
      setSelectedMascot(null);
    }
  };
  const openPicker = async () => {
    if (phaseRef.current) return;
    const id = sessionRef.current;
    changePhase('reading');
    setCropError(null);
    setSaveError(null);
    try {
      const picked = await pickImage();
      if (!picked || sessionRef.current !== id) return;
      const source = await prepareSource(picked.uri);
      if (sessionRef.current !== id) return;
      if ('error' in source) {
        setCropError(source.error);
        return;
      }
      setImageSize(
        source.width > 0 && source.height > 0
          ? { width: source.width, height: source.height }
          : null,
      );
      // The oriented source is shared by the preview and export, including the fallback client.
      viewRef.current = { zoom: 1, position: CENTERED_AVATAR };
      setView(viewRef.current);
      setPickedUri(source.uri);
      setStep('closed');
    } catch {
      if (sessionRef.current === id) setCropError('failed');
    } finally {
      if (sessionRef.current === id) changePhase(null);
    }
  };
  const confirmCrop = async () => {
    if (!pickedUri || !imageSize || phaseRef.current) return;
    const id = sessionRef.current;
    changePhase('processing');
    setCropError(null);
    setSaveError(null);
    try {
      const prepared = await prepareImage({
        uri: pickedUri,
        ...viewRef.current,
      });
      if (sessionRef.current !== id) return;
      if ('error' in prepared) {
        setCropError(prepared.error);
        return;
      }
      if (await save(prepared.dataUrl)) {
        setPickedUri(null);
        setImageSize(null);
      }
    } catch {
      if (sessionRef.current === id) setCropError('failed');
    } finally {
      if (sessionRef.current === id && phaseRef.current !== 'saving')
        changePhase(null);
    }
  };
  const point = (event: GestureResponderEvent) => ({
    x: event.nativeEvent.pageX,
    y: event.nativeEvent.pageY,
  });
  const startDrag = (event: GestureResponderEvent) => {
    if (!imageSize || phaseRef.current) return;
    setDragging(true);
    event.preventDefault?.();
    dragRef.current = { ...point(event), position: viewRef.current.position };
  };
  const moveDrag = (event: GestureResponderEvent) => {
    if (!dragRef.current || !imageSize || phaseRef.current) return;
    event.preventDefault?.();
    const current = point(event);
    changeView(
      viewRef.current.zoom,
      panAvatarPosition({
        ...imageSize,
        width: imageSize.width,
        height: imageSize.height,
        frame: frameSide,
        zoom: viewRef.current.zoom,
        position: dragRef.current.position,
        dx: current.x - dragRef.current.x,
        dy: current.y - dragRef.current.y,
      }),
    );
  };
  const errorText = saveError
    ? t(
        saveError === 'sync_failed'
          ? 'account.avatarSyncFailed'
          : 'account.avatarSaveFailed',
      )
    : cropError
      ? t(
          cropError === 'unavailable'
            ? 'account.avatarCropUnavailable'
            : 'account.avatarCropFailed',
        )
      : null;

  return (
    <View style={styles.field}>
      <View style={styles.row}>
        <ProfileAvatar
          username={username}
          imageUri={imageUri}
          imageSource={imageSource}
          testID={testID}
        />
        <View style={styles.side}>
          {children}
          <View style={styles.actions}>
            <Pressable
              testID={`${testID}-add`}
              accessibilityRole="button"
              accessibilityLabel={t('account.avatarChoose')}
              disabled={busy}
              onPress={() => {
                sessionRef.current++;
                setSaveError(null);
                setCropError(null);
                setStep('choice');
              }}
              style={[styles.btn, { borderColor: colors.border }]}
            >
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {t('account.avatarChoose')}
              </Text>
            </Pressable>
            {imageUri || imageSource ? (
              <Pressable
                testID={`${testID}-remove`}
                accessibilityRole="button"
                accessibilityLabel={t('account.avatarRemove')}
                disabled={busy}
                onPress={() => {
                  if (!phaseRef.current) void save(null);
                }}
                style={[styles.btn, { borderColor: colors.border }]}
              >
                <Text
                  style={[styles.actionText, { color: colors.destructive }]}
                >
                  {t('account.avatarRemove')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      {!dialogOpen && busy ? (
        <ActivityIndicator
          color={colors.primary}
          accessibilityLabel={t('account.avatarSaving')}
        />
      ) : null}
      {!dialogOpen && errorText ? (
        <Text
          testID="avatar-save-error"
          accessibilityRole="alert"
          style={{ color: colors.destructive }}
        >
          {errorText}
        </Text>
      ) : null}
      <Modal
        visible={dialogOpen}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={dismiss}
      >
        <View style={styles.backdrop} collapsable={false}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.cardContent}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={!dragging}
            >
              {step === 'choice' && !pickedUri ? (
                <View style={styles.content} testID="avatar-choice-modal">
                  <Text style={[styles.title, { color: colors.foreground }]}>
                    {t('account.avatarChoiceTitle')}
                  </Text>
                  <AppButton
                    testID="avatar-choice-mascot"
                    label={t('account.chooseMascot')}
                    disabled={busy}
                    onPress={openGallery}
                  />
                  <AppButton
                    testID="avatar-choice-import"
                    label={t('account.importImage')}
                    variant="secondary"
                    disabled={busy}
                    onPress={openPicker}
                  />
                  <AppButton
                    testID="avatar-choice-cancel"
                    label={t('common.cancel')}
                    variant="secondary"
                    onPress={dismiss}
                  />
                </View>
              ) : null}
              {step === 'gallery' && !pickedUri ? (
                <View style={styles.content} testID="avatar-mascot-modal">
                  <Text style={[styles.title, { color: colors.foreground }]}>
                    {t('account.mascotTitle')}
                  </Text>
                  <View style={styles.gallery}>
                    {ANYCHESS_MASCOTS.map((mascot) => {
                      const selected = selectedMascot === mascot.id;
                      return (
                        <Pressable
                          key={mascot.id}
                          testID={`avatar-mascot-${mascot.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={t(mascot.labelKey)}
                          accessibilityState={{ selected }}
                          disabled={busy}
                          onPress={() => setSelectedMascot(mascot.id)}
                          style={[
                            styles.mascotCell,
                            {
                              borderColor: selected
                                ? colors.primary
                                : colors.border,
                              backgroundColor: colors.background,
                            },
                          ]}
                        >
                          {sources[mascot.id] ? (
                            <Image
                              source={sources[mascot.id]}
                              style={styles.mascotImage}
                              resizeMode="contain"
                            />
                          ) : null}
                          <Text
                            style={[
                              styles.mascotLabel,
                              {
                                color: selected
                                  ? colors.primary
                                  : colors.foreground,
                              },
                            ]}
                          >
                            {t(mascot.labelKey)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <AppButton
                    testID="avatar-mascot-confirm"
                    label={t('account.mascotConfirm')}
                    disabled={!selectedMascot || busy}
                    onPress={confirmMascot}
                  />
                  <AppButton
                    testID="avatar-mascot-cancel"
                    label={t('common.cancel')}
                    variant="secondary"
                    disabled={phase === 'saving'}
                    onPress={dismiss}
                  />
                </View>
              ) : null}
              {pickedUri ? (
                <View
                  style={styles.content}
                  collapsable={false}
                  testID="avatar-crop-modal"
                >
                  <Text style={[styles.title, { color: colors.foreground }]}>
                    {t('account.avatarCrop')}
                  </Text>
                  <Text style={{ color: colors.mutedForeground }}>
                    {t('account.avatarDragHint')}
                  </Text>
                  <View
                    testID="avatar-crop-slot"
                    onLayout={(event) => {
                      if (event.nativeEvent.layout.width > 0)
                        setFrameWidth(event.nativeEvent.layout.width);
                    }}
                    style={styles.slot}
                  >
                    <View
                      testID="avatar-crop-frame"
                      collapsable={false}
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={t('account.avatarDragHint')}
                      accessibilityActions={[
                        { name: 'left', label: t('account.avatarMoveLeft') },
                        { name: 'right', label: t('account.avatarMoveRight') },
                        { name: 'up', label: t('account.avatarMoveUp') },
                        { name: 'down', label: t('account.avatarMoveDown') },
                      ]}
                      onAccessibilityAction={(event) => {
                        if (!imageSize || phaseRef.current) return;
                        const action = event.nativeEvent.actionName;
                        changeView(
                          viewRef.current.zoom,
                          panAvatarPosition({
                            ...imageSize,
                            frame: frameSide,
                            zoom: viewRef.current.zoom,
                            position: viewRef.current.position,
                            dx:
                              action === 'left'
                                ? -20
                                : action === 'right'
                                  ? 20
                                  : 0,
                            dy:
                              action === 'up'
                                ? -20
                                : action === 'down'
                                  ? 20
                                  : 0,
                          }),
                        );
                      }}
                      onStartShouldSetResponder={() =>
                        !phaseRef.current && imageSize != null
                      }
                      onMoveShouldSetResponder={() =>
                        !phaseRef.current && imageSize != null
                      }
                      onResponderTerminationRequest={() => false}
                      onResponderGrant={startDrag}
                      onResponderMove={moveDrag}
                      onResponderRelease={() => {
                        dragRef.current = null;
                        setDragging(false);
                      }}
                      onResponderTerminate={() => {
                        dragRef.current = null;
                        setDragging(false);
                      }}
                      style={{
                        ...styles.frame,
                        width: frameSide,
                        height: frameSide,
                        ...(Platform.OS === 'web'
                          ? ({
                              touchAction: 'none',
                              userSelect: 'none',
                            } as object)
                          : {}),
                      }}
                    >
                      <Image
                        source={{ uri: pickedUri }}
                        resizeMode="stretch"
                        testID="avatar-crop-preview"
                        onLoad={(event) => {
                          const source = event.nativeEvent.source;
                          if (
                            !imageSize &&
                            source.width > 0 &&
                            source.height > 0
                          )
                            setImageSize({
                              width: source.width,
                              height: source.height,
                            });
                        }}
                        onError={() => {
                          setImageSize(null);
                          setCropError('failed');
                        }}
                        style={{
                          position: 'absolute',
                          width: preview?.width ?? frameSide,
                          height: preview?.height ?? frameSide,
                          left: preview?.left ?? 0,
                          top: preview?.top ?? 0,
                        }}
                      />
                    </View>
                  </View>
                  <Text style={{ color: colors.mutedForeground }}>
                    {t('account.avatarZoom')}
                  </Text>
                  <View
                    testID="avatar-crop-zoom"
                    accessibilityRole="adjustable"
                    accessibilityLabel={t('account.avatarZoom')}
                    accessibilityValue={{ min: 1, max: 3, now: view.zoom }}
                    accessibilityActions={[
                      { name: 'increment' },
                      { name: 'decrement' },
                    ]}
                    onAccessibilityAction={(event) => {
                      if (!phaseRef.current)
                        changeView(
                          viewRef.current.zoom +
                            (event.nativeEvent.actionName === 'increment'
                              ? 0.1
                              : -0.1),
                        );
                    }}
                    onLayout={(event) => {
                      if (event.nativeEvent.layout.width > 0)
                        setTrackWidth(event.nativeEvent.layout.width);
                    }}
                    onStartShouldSetResponder={() => !phaseRef.current}
                    onMoveShouldSetResponder={() => !phaseRef.current}
                    onResponderTerminationRequest={() => false}
                    onResponderGrant={(event) => {
                      if (!phaseRef.current) {
                        setDragging(true);
                        changeView(
                          zoomFromTrack(
                            event.nativeEvent.locationX,
                            trackWidth,
                          ),
                        );
                      }
                    }}
                    onResponderMove={(event) => {
                      if (!phaseRef.current)
                        changeView(
                          zoomFromTrack(
                            event.nativeEvent.locationX,
                            trackWidth,
                          ),
                        );
                    }}
                    onResponderRelease={() => setDragging(false)}
                    onResponderTerminate={() => setDragging(false)}
                    style={styles.trackHit}
                  >
                    <View
                      style={[styles.track, { backgroundColor: colors.border }]}
                    />
                    <View
                      style={[
                        styles.thumb,
                        {
                          backgroundColor: colors.primary,
                          left:
                            (Math.max(0, trackWidth - 22) * (view.zoom - 1)) /
                            2,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.actions}>
                    <AppButton
                      testID="avatar-zoom-out"
                      label={t('account.avatarZoomOut')}
                      variant="secondary"
                      disabled={busy || view.zoom <= 1}
                      onPress={() => changeView(viewRef.current.zoom - 0.1)}
                    />
                    <AppButton
                      testID="avatar-zoom-in"
                      label={t('account.avatarZoomIn')}
                      variant="secondary"
                      disabled={busy || view.zoom >= 3}
                      onPress={() => changeView(viewRef.current.zoom + 0.1)}
                    />
                  </View>
                  <AppButton
                    testID="avatar-use-full"
                    label={t('account.avatarResetCrop')}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => changeView(1, CENTERED_AVATAR)}
                  />
                  <AppButton
                    testID="avatar-crop-confirm"
                    label={
                      busy ? t('account.avatarSaving') : t('common.validate')
                    }
                    disabled={busy || !imageSize}
                    onPress={confirmCrop}
                  />
                  <AppButton
                    testID="avatar-crop-cancel"
                    label={t('common.cancel')}
                    variant="secondary"
                    disabled={phase === 'saving'}
                    onPress={dismiss}
                  />
                </View>
              ) : null}
              {busy ? (
                <ActivityIndicator
                  color={colors.primary}
                  testID="avatar-crop-busy"
                />
              ) : null}
              {errorText ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.destructive }}
                  testID="avatar-crop-error-modal"
                >
                  {errorText}
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: DesignTokens.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
    flexWrap: 'wrap',
  },
  side: { flex: 1, minWidth: 150, gap: DesignTokens.spacing.sm },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DesignTokens.spacing.sm,
  },
  btn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: DesignTokens.minTouchTarget,
    justifyContent: 'center',
    flexShrink: 1,
  },
  actionText: {
    fontFamily: DesignTokens.typography.weightSemiBold,
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    maxHeight: '94%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    overflow: 'hidden',
  },
  cardContent: { padding: 16, gap: 10 },
  content: { gap: 10 },
  title: { fontFamily: DesignTokens.typography.weightBold, fontSize: 18 },
  slot: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  frame: {
    overflow: 'hidden',
    borderRadius: DesignTokens.radius.sm,
    backgroundColor: 'transparent',
  },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mascotCell: {
    flexBasis: 88,
    flexGrow: 1,
    maxWidth: 136,
    minHeight: 112,
    borderWidth: 2,
    borderRadius: DesignTokens.radius.md,
    padding: 6,
    alignItems: 'center',
    gap: 4,
  },
  mascotImage: { width: 72, height: 72 },
  mascotLabel: {
    fontSize: DesignTokens.typography.micro,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
    flexShrink: 1,
  },
  trackHit: { height: DesignTokens.minTouchTarget, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2 },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11 },
});
