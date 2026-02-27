import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
}

/**
 * Cross-platform confirm dialog.
 * Web: uses window.confirm (synchronous, wrapped in Promise).
 * Native: uses Alert.alert with Cancel / destructive confirm.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(
      typeof window !== 'undefined' &&
        window.confirm(`${options.title}\n\n${options.message}`),
    );
  }
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: options.confirmText ?? 'Confirm',
        style: 'destructive',
        onPress: () => resolve(true),
      },
    ]);
  });
}
