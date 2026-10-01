/**
 * AnyChess confirmation / info dialog — design-system card over a dimmed backdrop.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';
import {
  buildDialogActions,
  layoutDialogActions,
  shouldUseActionRow,
} from '@/lib/ui/appDialogActions';
import type { AppDialogAction, AppDialogVariant } from '@/lib/ui/appDialogStore';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  variant?: AppDialogVariant;
  actions?: AppDialogAction[];
  loading?: boolean;
  testID?: string;
  /** When true, tapping the dimmed backdrop runs onCancel. Default false. */
  dismissOnBackdrop?: boolean;
};

export function AppDialog({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  variant = 'confirm',
  actions,
  loading = false,
  testID = 'app-dialog',
  dismissOnBackdrop = false,
}: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.97)).current;
  const body = message?.trim() ? message.trim() : undefined;
  const items = useMemo(
    () =>
      buildDialogActions({
        actions,
        cancelLabel,
        confirmLabel,
        onCancel,
        onConfirm,
      }),
    [actions, cancelLabel, confirmLabel, onCancel, onConfirm, variant],
  );

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(0.97);
      return;
    }
    opacity.setValue(0);
    scale.setValue(0.97);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, scale]);

  const handleRequestClose = () => {
    onCancel?.();
  };

  const cardWidth = Math.min(width * 0.88, 420);
  const row = shouldUseActionRow(items.length, width);
  const visibleActions = layoutDialogActions(items, row);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[styles.backdrop, { opacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (dismissOnBackdrop) onCancel?.();
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Animated.View
          accessible
          accessibilityRole="alert"
          accessibilityLabel={title}
          accessibilityViewIsModal
          testID={testID}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              width: cardWidth,
              transform: [{ scale }],
            },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.foreground }]}
            testID="app-dialog-title"
          >
            {title}
          </Text>
          {body ? (
            <Text
              style={[styles.message, { color: colors.mutedForeground }]}
              testID="app-dialog-message"
            >
              {body}
            </Text>
          ) : null}
          <View style={[styles.actions, row ? styles.actionsRow : styles.actionsStack]}>
            {visibleActions.map((action) => {
              const kind = action.variant ?? 'secondary';
              return (
                <AppButton
                  key={action.testID ?? action.label}
                  label={action.label}
                  onPress={action.onPress}
                  variant={kind}
                  disabled={loading}
                  testID={action.testID}
                  style={[
                    row ? styles.actionFlex : undefined,
                    kind === 'secondary' ? { backgroundColor: colors.secondary } : undefined,
                  ]}
                />
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DesignTokens.spacing.xl,
  },
  card: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.card,
    padding: DesignTokens.spacing.xl,
    gap: DesignTokens.spacing.md,
  },
  title: {
    fontSize: DesignTokens.typography.modeTitle,
    lineHeight: 22,
    fontFamily: DesignTokens.typography.weightBold,
  },
  message: {
    fontSize: DesignTokens.typography.body,
    lineHeight: 20,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  actions: {
    marginTop: DesignTokens.spacing.xs,
    gap: DesignTokens.spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionsStack: {
    flexDirection: 'column',
  },
  actionFlex: {
    flex: 1,
  },
});
