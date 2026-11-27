import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { useTranslation } from '@/hooks/useTranslation';
import { useColors } from '@/hooks/useColors';
import { initialsFromUsername } from '@/lib/profile/avatarInitials';

type Props = {
  username: string | null | undefined;
  imageUri?: string | null;
  imageSource?: ImageSourcePropType | null;
  size?: number;
  testID?: string;
};

/** Rounded square. The photo covers the frame and stays centered. */
export function ProfileAvatar({
  username,
  imageUri,
  imageSource,
  size = 72,
  testID,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const initials = initialsFromUsername(username);
  const source = imageSource ?? (imageUri ? { uri: imageUri } : null);
  return (
    <View
      testID={testID}
      accessibilityLabel={t('profil.avatarFor', {
        name: username || t('profil.pseudoUnset'),
      })}
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: DesignTokens.radius.md,
          backgroundColor: colors.card,
          borderColor: colors.primary,
        },
      ]}
    >
      {source ? (
        <Image
          source={source}
          style={{ width: size - 2, height: size - 2 }}
          resizeMode={imageSource ? 'contain' : 'cover'}
          testID={testID ? `${testID}-image` : undefined}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            { color: colors.primary, fontSize: Math.round(size * 0.32) },
          ]}
          testID={testID ? `${testID}-initials` : undefined}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: DesignTokens.typography.weightBold,
  },
});
