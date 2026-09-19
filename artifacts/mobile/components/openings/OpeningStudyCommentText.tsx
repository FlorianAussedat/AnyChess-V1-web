import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';
import type { CommentToken } from '@/lib/openingStudy';

type Props = {
  tokens: CommentToken[];
  emptyLabel: string;
  onPlaySans?: (sans: string[], startFen?: string) => void;
  testID?: string;
};

export function OpeningStudyCommentText({ tokens, emptyLabel, onPlaySans, testID }: Props) {
  const colors = useColors();
  const onlyEmpty = tokens.length === 1 && tokens[0]?.kind === 'text' && !tokens[0].text.trim();

  if (!tokens.length || onlyEmpty) {
    return (
      <Text style={[styles.empty, { color: colors.mutedForeground }]} testID={testID}>
        {emptyLabel}
      </Text>
    );
  }

  return (
    <Text style={[styles.body, { color: colors.foreground }]} testID={testID}>
      {tokens.map((tok, i) => {
        if (tok.kind === 'text') {
          return <Text key={i}>{tok.text}</Text>;
        }
        const accent = (
          <Text
            key={i}
            style={{
              color: colors.primary,
              fontFamily: DesignTokens.typography.weightSemiBold,
            }}
          >
            {tok.text}
          </Text>
        );
        if (!tok.playable || !tok.playSans || !onPlaySans) return accent;
        return (
          <Text key={i} onPress={() => onPlaySans(tok.playSans!, tok.startFen)}>
            {accent}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
    textAlign: 'left',
  },
  empty: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    textAlign: 'left',
  },
});
