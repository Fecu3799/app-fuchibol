import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import type { Notification, NotificationResponse } from 'expo-notifications';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator, { navigationRef } from './src/navigation/AppNavigator';

// Wire React Query's focusManager to AppState so refetchOnWindowFocus works on native.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      setFocused(status === 'active');
    });
    return () => subscription.remove();
  });
}

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

function navigateWhenReady(
  data: Record<string, unknown> | null,
  attempt = 0,
): void {
  if (navigationRef.isReady()) {
    handleNotificationTap(data);
  } else if (attempt < 10) {
    setTimeout(() => navigateWhenReady(data, attempt + 1), 150);
  }
}

function handleNotificationTap(data?: Record<string, unknown> | null) {
  if (!data || !navigationRef.isReady()) return;

  if (data.type === 'chat_message') {
    const convType = data.conversationType;
    if (convType === 'MATCH' && typeof data.matchId === 'string') {
      navigationRef.navigate('MatchChat', { matchId: data.matchId });
    } else if (
      convType === 'GROUP' &&
      typeof data.groupId === 'string' &&
      typeof data.groupName === 'string'
    ) {
      navigationRef.navigate('GroupChat', { groupId: data.groupId, groupName: data.groupName });
    } else if (
      convType === 'DIRECT' &&
      typeof data.conversationId === 'string' &&
      typeof data.otherUsername === 'string'
    ) {
      navigationRef.navigate('DirectChat', {
        conversationId: data.conversationId,
        otherUsername: data.otherUsername,
      });
    }
    return;
  }

  // Legacy: match event notifications navigate to MatchDetail
  if (typeof data.matchId === 'string' && data.matchId) {
    navigationRef.navigate('MatchDetail', { matchId: data.matchId });
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

    // Tap: navigate to the appropriate screen based on notification payload.
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: NotificationResponse) => {
        const data = response.notification.request.content.data as Record<string, unknown> | null;
        if (__DEV__) {
          console.log('[Push] Tapped notification, data:', JSON.stringify(data));
        }
        handleNotificationTap(data);
      },
    );

    // Handle notification that launched the app (cold start tap).
    // Poll until navigator is ready to avoid race condition on startup.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, unknown> | null;
      navigateWhenReady(data);
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
