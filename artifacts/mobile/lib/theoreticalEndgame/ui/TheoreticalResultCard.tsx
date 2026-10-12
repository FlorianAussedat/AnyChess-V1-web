import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  headline: string;
  comment: string | null;
  stats: string;
  official: string | null;
  tone: string;
  commentColor: string;
  statsColor: string;
};

/** Result block shared by the play screen and the component test. */
export function TheoreticalResultCard({
  headline,
  comment,
  stats,
  official,
  tone,
  commentColor,
  statsColor,
}: Props) {
  return (
    <View testID="theoretical-result">
      <Text
        style={{ color: tone, textAlign: 'center', fontFamily: 'Inter_600SemiBold' }}
        testID="theoretical-quality-headline"
      >
        {headline}
      </Text>
      {comment ? (
        <Text style={{ color: commentColor, textAlign: 'center' }} testID="theoretical-quality-comment">
          {comment}
        </Text>
      ) : null}
      <Text style={{ color: statsColor, textAlign: 'center' }} testID="theoretical-quality-stats">
        {stats}
      </Text>
      {official ? (
        <Text style={{ color: tone, textAlign: 'center' }} testID="theoretical-official-result">
          {official}
        </Text>
      ) : null}
    </View>
  );
}
