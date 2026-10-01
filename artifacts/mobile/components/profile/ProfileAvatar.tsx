import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { initialsFromUsername } from '@/lib/profile/avatarInitials';

type Props = {
  username: string | null | undefined;
  imageUri?: string | null;
  size?: number;
  testID?: string;
};

/** Rounded frame. The image is contained so a logo keeps its shape and transparency. */
export function ProfileAvatar({ username, imageUri, size = 72, testID }: Props) {
  const colors = useColors();
  const initials = initialsFromUsername(username);
  return (
    <View
      testID={testID}
      accessibilityLabel={imageUri ? initials : initials}
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
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: size - 2, height: size - 2 }}
          resizeMode="contain"
          testID={testID ? `${testID}-image` : undefined}
        />
      ) : (
        <Text
          style={[styles.initials, { color: colors.primary, fontSize: Math.round(size * 0.32) }]}
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
