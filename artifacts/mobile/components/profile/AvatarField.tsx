import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import {
  avatarPreviewLayout,
  prepareAvatarImage,
  zoomFromTrack,
  type AvatarPrepareError,
} from '@/lib/profile/avatarImage';
import type { PickedProfileImage } from '@/lib/profile/pickProfileImage';
import { ProfileAvatar } from './ProfileAvatar';

async function defaultPickImage(): Promise<PickedProfileImage | null> {
  const { pickProfileImage } = await import('@/lib/profile/pickProfileImage');
  return pickProfileImage();
}

const PREVIEW_MAX_HEIGHT = 220;

type SaveOutcome = void | 'failed' | 'sync_failed';

type Props = {
  username: string | null;
  imageUri: string | null;
  onChange: (
    dataUrl: string | null,
    context?: { cancelled: () => boolean },
  ) => SaveOutcome | Promise<SaveOutcome>;
  children?: ReactNode;
  testID?: string;
  pickImage?: () => Promise<PickedProfileImage | null>;
  prepareImage?: typeof prepareAvatarImage;
};

export function AvatarField({
  username,
  imageUri,
  onChange,
  children,
  testID = 'avatar-field',
  pickImage = defaultPickImage,
  prepareImage = prepareAvatarImage,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [cropError, setCropError] = useState<AvatarPrepareError | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [frameWidth, setFrameWidth] = useState(280);
  const [trackWidth, setTrackWidth] = useState(1);
  const sessionRef = useRef(0);
  const busyRef = useRef(false);
  const dismissRef = useRef<() => void>(() => {});

  const dismiss = () => {
    sessionRef.current += 1;
    busyRef.current = false;
    setBusy(false);
    setCropError(null);
    setZoom(1);
    setImageSize(null);
    setPickedUri(null);
  };
  dismissRef.current = dismiss;

  useEffect(() => {
    if (!pickedUri || typeof BackHandler?.addEventListener !== 'function') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [pickedUri]);

  const openPicker = async () => {
    const picked = await pickImage();
    if (!picked) return;
    setCropError(null);
    setZoom(1);
    setImageSize(null);
    setBusy(false);
    busyRef.current = false;
    setPickedUri(picked.uri);
  };

  const confirmCrop = async () => {
    if (!pickedUri || busyRef.current) return;
    const id = sessionRef.current;
    const uri = pickedUri;
    const chosenZoom = zoom;
    busyRef.current = true;
    setBusy(true);
    setCropError(null);
    try {
      const prepared = await prepareImage({ uri, zoom: chosenZoom });
      if (sessionRef.current !== id) return;
      if ('error' in prepared) {
        setCropError(prepared.error);
        return;
      }
      const outcome = await onChange(prepared.dataUrl, {
        cancelled: () => sessionRef.current !== id,
      });
      if (sessionRef.current !== id) return;
      if (outcome === 'failed') {
        setCropError('failed');
        return;
      }
      setCropError(null);
      setZoom(1);
      setImageSize(null);
      setPickedUri(null);
    } catch {
      if (sessionRef.current !== id) return;
      setCropError('failed');
    } finally {
      if (sessionRef.current === id) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const layout = imageSize
    ? avatarPreviewLayout({
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        maxWidth: frameWidth,
        maxHeight: PREVIEW_MAX_HEIGHT,
        zoom,
      })
    : null;
  const errorText =
    cropError === 'unavailable'
      ? t('account.avatarCropUnavailable')
      : cropError === 'failed' || cropError === 'unsupported'
        ? t('account.avatarCropFailed')
        : null;

  return (
    <View style={styles.row}>
      <ProfileAvatar username={username} imageUri={imageUri} testID={testID} />
      <View style={styles.side}>
        {children}
        <View style={styles.actions}>
            <Pressable
            testID={`${testID}-add`}
            onPress={() => openPicker()}
            style={[styles.btn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.primary }}>
              {imageUri ? t('account.avatarChange') : t('account.avatarAdd')}
            </Text>
          </Pressable>
          {imageUri ? (
            <Pressable
              testID={`${testID}-remove`}
              onPress={() => onChange(null)}
              style={[styles.btn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.destructive }}>{t('account.avatarRemove')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Modal
        visible={pickedUri != null}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={dismiss}
      >
        <View style={styles.backdrop} collapsable={false}>
          <View
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            collapsable={false}
            testID="avatar-crop-modal"
          >
            <Text style={[styles.title, { color: colors.foreground }]}>{t('account.avatarCrop')}</Text>
            <View
              testID="avatar-crop-slot"
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                if (width > 0) setFrameWidth(width);
              }}
              style={styles.slot}
            >
              {pickedUri ? (
                <View
                  testID="avatar-crop-frame"
                  style={{
                    ...styles.frame,
                    width: layout?.frameWidth ?? frameWidth,
                    height: layout?.frameHeight ?? PREVIEW_MAX_HEIGHT,
                  }}
                >
                  <Image
                    source={{ uri: pickedUri }}
                    resizeMode="cover"
                    testID="avatar-crop-preview"
                    onLoad={(event) => {
                      const source = event.nativeEvent.source;
                      if (source.width > 0 && source.height > 0) {
                        setImageSize({ width: source.width, height: source.height });
                      }
                    }}
                    style={{
                      width: layout?.frameWidth ?? frameWidth,
                      height: layout?.frameHeight ?? PREVIEW_MAX_HEIGHT,
                      transform: [{ scale: layout?.scale ?? zoom }],
                    }}
                  />
                </View>
              ) : null}
            </View>
            <Text style={{ color: colors.mutedForeground }}>{t('account.avatarZoom')}</Text>
            <View
              testID="avatar-crop-zoom"
              accessibilityRole="adjustable"
              accessibilityValue={{ min: 1, max: 3, now: zoom }}
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                if (width > 0) setTrackWidth(width);
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={(event) => {
                setZoom(zoomFromTrack(event.nativeEvent.locationX, trackWidth));
              }}
              onResponderMove={(event) => {
                setZoom(zoomFromTrack(event.nativeEvent.locationX, trackWidth));
              }}
              style={styles.trackHit}
            >
              <View style={[styles.track, { backgroundColor: colors.border }]} />
              <View
                style={[
                  styles.thumb,
                  {
                    backgroundColor: colors.primary,
                    left: `${((zoom - 1) / 2) * 100}%`,
                  },
                ]}
              />
            </View>
            <AppButton
              testID="avatar-use-full"
              label={t('account.avatarUseFull')}
              variant="secondary"
              onPress={() => setZoom(1)}
            />
            <AppButton
              testID="avatar-crop-confirm"
              label={busy ? t('account.avatarSaving') : t('common.validate')}
              disabled={busy}
              onPress={() => confirmCrop()}
            />
            {busy ? <ActivityIndicator color={colors.primary} testID="avatar-crop-busy" /> : null}
            {errorText ? (
              <Text style={{ color: colors.destructive }} testID="avatar-crop-error-modal">
                {errorText}
              </Text>
            ) : null}
            <AppButton
              testID="avatar-crop-cancel"
              label={t('common.cancel')}
              variant="secondary"
              disabled={false}
              onPress={dismiss}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  side: { flex: 1, gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: DesignTokens.minTouchTarget,
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    padding: 16,
    gap: 10,
  },
  title: {
    fontFamily: DesignTokens.typography.weightBold,
    fontSize: 18,
  },
  slot: {
    width: '100%',
    height: PREVIEW_MAX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  trackHit: {
    height: DesignTokens.minTouchTarget,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -11,
  },
});
