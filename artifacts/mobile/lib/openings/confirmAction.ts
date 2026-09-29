import { Alert, Platform } from 'react-native';

/** Web confirm() / native Alert — returns whether the user accepted. */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean },
): void {
  const body = message.trim();
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(body ? `${title}\n\n${body}` : title)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, body || undefined, [
    { text: options?.cancelLabel ?? 'Annuler', style: 'cancel' },
    {
      text: options?.confirmLabel ?? 'OK',
      style: options?.destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}
