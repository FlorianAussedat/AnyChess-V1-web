import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Action = {
  label: string;
  onPress: () => void;
  testID: string;
  primary?: boolean;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  body: string;
  actions: Action[];
  testID?: string;
};

export function OpeningChoiceModal({ visible, title, body, actions, testID }: Props) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={actions[actions.length - 1]?.onPress}>
      <View style={styles.backdrop}>
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID={testID}
        >
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>
          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.testID}
                testID={action.testID}
                onPress={action.onPress}
                style={[
                  styles.btn,
                  {
                    backgroundColor: action.primary
                      ? colors.primary
                      : action.destructive
                        ? colors.destructive
                        : colors.secondary,
                    borderColor: action.primary
                      ? colors.primary
                      : action.destructive
                        ? colors.destructive
                        : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: action.primary || action.destructive ? colors.primaryForeground : colors.foreground,
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 13,
                    textAlign: 'center',
                  }}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  body: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  actions: { gap: 8, marginTop: 4 },
  btn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
});
