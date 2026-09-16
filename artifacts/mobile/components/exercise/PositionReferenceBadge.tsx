/**
 * Discrete position reference — tap to copy.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { copyToClipboard } from '@/lib/clipboard';
import { useColors } from '@/hooks/useColors';
import {
  copyablePositionReference,
  formatPositionReference,
  type PositionRefInput,
} from '@/lib/review/formatPositionReference';

type Props = PositionRefInput & {
  testID?: string;
};

export function PositionReferenceBadge({ id, sourceId, provider, testID }: Props) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const label = formatPositionReference({ id, sourceId, provider });

  const onPress = useCallback(async () => {
    await copyToClipboard(copyablePositionReference({ id, sourceId, provider }));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [id, sourceId, provider]);

  return (
    <>
      <Pressable onPress={() => void onPress()} hitSlop={8} testID={testID ?? 'position-reference'}>
        <Text style={[styles.ref, { color: colors.mutedForeground }]}>{label}</Text>
      </Pressable>
      {copied && (
        <Text style={[styles.copied, { color: colors.primary }]} testID="position-reference-copied">
          Référence copiée
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  ref: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  copied: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
