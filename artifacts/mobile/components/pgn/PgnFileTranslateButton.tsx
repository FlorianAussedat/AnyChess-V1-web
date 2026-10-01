import React from 'react';
import { Pressable, Text } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useCloudAccount } from '@/hooks/useCloudAccount';
import { useTranslation } from '@/hooks/useTranslation';
import { setAuthReturn } from '@/lib/cloud/authReturn';
import { usePgnCommentTranslations } from '@/hooks/usePgnCommentTranslations';
import {
  describePgnFileTranslation,
  enqueueExistingPgns,
  type PgnCommentSource,
} from '@/lib/pgnComments';
import { fileTranslateLabel } from './PgnTranslationActions';

type Props = {
  source: PgnCommentSource;
  fileId: string;
  filename: string;
  pgnText: string;
  testID?: string;
};

export function PgnFileTranslateButton({
  source,
  fileId,
  pgnText,
  testID,
}: Props) {
  const colors = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const cloud = useCloudAccount();
  const { t } = useTranslation();
  usePgnCommentTranslations();
  const info = describePgnFileTranslation(source, fileId, pgnText);
  const label = fileTranslateLabel(info.status, t);
  const disabled = info.status === 'none' || info.status === 'ready' || info.status === 'manual';

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        if (!cloud.sessionReady) return;
        if (!cloud.user) {
          setAuthReturn(pathname || '/');
          router.push('/utilisateur' as Href);
          return;
        }
        void enqueueExistingPgns([{ source, fileId, pgnText }]);
      }}
      testID={testID}
      accessibilityLabel={label}
    >
      <Text
        style={{
          color: disabled ? colors.mutedForeground : colors.primary,
          fontSize: 12,
          fontFamily: 'Inter_600SemiBold',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
