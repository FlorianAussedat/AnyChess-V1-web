import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Image } from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { prepareAvatarImage } from '@/lib/profile/avatarImage';
import { pickProfileImage } from '@/lib/profile/pickProfileImage';
import { ProfileAvatar } from './ProfileAvatar';

type Props = {
  username: string | null;
  imageUri: string | null;
  onChange: (dataUrl: string | null) => void;
  testID?: string;
};

export function AvatarField({ username, imageUri, onChange, testID = 'avatar-field' }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);

  const openPicker = async () => {
    const picked = await pickProfileImage();
    if (!picked) return;
    setZoom(1);
    setPickedUri(picked.uri);
  };

  const confirmCrop = async () => {
    if (!pickedUri) return;
    setBusy(true);
    const prepared = await prepareAvatarImage({ uri: pickedUri, zoom });
    setBusy(false);
    setPickedUri(null);
    if ('dataUrl' in prepared) onChange(prepared.dataUrl);
  };

  return (
    <View style={styles.wrap}>
      <ProfileAvatar username={username} imageUri={imageUri} testID={testID} />
      <View style={styles.actions}>
        <Pressable
          testID={`${testID}-add`}
          onPress={() => {
            void openPicker();
          }}
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
      <Modal visible={pickedUri != null} transparent animationType="fade" onRequestClose={() => setPickedUri(null)}>
        <View style={styles.backdrop}>
          <View
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            testID="avatar-crop-modal"
          >
            <Text style={[styles.title, { color: colors.foreground }]}>{t('account.avatarCrop')}</Text>
            {pickedUri ? (
              <Image
                source={{ uri: pickedUri }}
                style={styles.preview}
                resizeMode="contain"
                testID="avatar-crop-preview"
              />
            ) : null}
            <Text style={{ color: colors.mutedForeground }}>{t('account.avatarZoom')}</Text>
            <Slider
              testID="avatar-crop-zoom"
              minimumValue={1}
              maximumValue={3}
              value={zoom}
              onValueChange={setZoom}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
            />
            <View style={styles.actions}>
              <Pressable
                testID="avatar-use-full"
                onPress={() => setZoom(1)}
                style={[styles.btn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.primary }}>{t('account.avatarUseFull')}</Text>
              </Pressable>
              <Pressable
                testID="avatar-crop-confirm"
                disabled={busy}
                onPress={() => {
                  void confirmCrop();
                }}
                style={[styles.btn, { borderColor: colors.primary }]}
              >
                <Text style={{ color: colors.primary }}>{t('common.validate')}</Text>
              </Pressable>
              <Pressable
                testID="avatar-crop-cancel"
                onPress={() => setPickedUri(null)}
                style={[styles.btn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.mutedForeground }}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
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
  preview: {
    width: '100%',
    height: 220,
    backgroundColor: 'transparent',
  },
});
