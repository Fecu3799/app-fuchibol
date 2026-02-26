import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import type { Notification, NotificationResponse } from 'expo-notifications';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator, { navigationRef } from './src/navigation/AppNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Show notifications while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function navigateToMatchIfPresent(data?: Record<string, unknown> | null) {
  const matchId = data?.matchId;
  if (typeof matchId === 'string' && matchId && navigationRef.isReady()) {
    navigationRef.navigate('MatchDetail', { matchId });
  }
}

export default function App() {
  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);
  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Foreground: log the notification (DEV only shows alert via handler above).
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification: Notification) => {
        if (__DEV__) {
          console.log('[Push] Received in foreground:', JSON.stringify(notification.request.content));
        }
      },
    );

    // Tap: navigate to MatchDetail if payload includes matchId.
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: NotificationResponse) => {
        const data = response.notification.request.content.data as Record<string, unknown> | null;
        if (__DEV__) {
          console.log('[Push] Tapped notification, data:', JSON.stringify(data));
        }
        navigateToMatchIfPresent(data);
      },
    );

    // Handle notification that launched the app (cold start tap).
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as Record<string, unknown> | null;
        navigateToMatchIfPresent(data);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
