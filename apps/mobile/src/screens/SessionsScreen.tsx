import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getSessions, deleteSession, postLogoutAll, postLogout } from '../features/auth/authClient';
import { useAuth } from '../contexts/AuthContext';
import { useLogoutOn401 } from '../lib/use-api-query';
import type { SessionItem } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Sessions'>;

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SessionsScreen(_: Props) {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const query = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
  });
  useLogoutOn401(query);

  const handleRevoke = useCallback(
    (session: SessionItem) => {
      if (session.isCurrent) {
        Alert.alert('Log out', 'Log out of this device?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log out',
            style: 'destructive',
            onPress: async () => {
              try {
                await postLogout();
              } catch {
                // ignore
              }
              logout();
            },
          },
        ]);
        return;
      }
      Alert.alert('Revoke session', 'Remove this device from your account?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setError('');
            try {
              await deleteSession(session.id);
              await queryClient.invalidateQueries({ queryKey: ['sessions'] });
            } catch {
              setError('Failed to revoke session. Please try again.');
            }
          },
        },
      ]);
    },
    [logout, queryClient],
  );

  const handleLogoutAll = useCallback(() => {
    Alert.alert('Log out all devices', 'This will log you out of every device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out all',
        style: 'destructive',
        onPress: async () => {
          setError('');
          try {
            await postLogoutAll();
            logout();
          } catch {
            setError('Failed to log out all devices. Please try again.');
          }
        },
      },
    ]);
  }, [logout]);

  const renderItem = ({ item }: { item: SessionItem }) => (
    <View style={styles.sessionRow}>
      <View style={styles.sessionInfo}>
        <View style={styles.sessionHeader}>
          <Text style={styles.deviceName}>{item.deviceName ?? 'Unknown device'}</Text>
          {item.isCurrent ? <Text style={styles.currentBadge}>This device</Text> : null}
        </View>
        <Text style={styles.sessionMeta}>
          {item.platform ?? 'Unknown platform'} · {formatRelative(item.lastUsedAt)}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.actionButton, item.isCurrent ? styles.logoutButton : styles.revokeButton]}
        onPress={() => handleRevoke(item)}
        activeOpacity={0.8}
      >
        <Text style={[styles.actionButtonText, item.isCurrent ? styles.actionButtonTextLight : null]}>
          {item.isCurrent ? 'Log out' : 'Revoke'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {query.isLoading ? (
        <ActivityIndicator style={styles.loading} size="large" />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No active sessions found.</Text>
          }
          ListFooterComponent={
            <TouchableOpacity style={styles.logoutAllButton} onPress={handleLogoutAll} activeOpacity={0.8}>
              <Text style={styles.logoutAllButtonText}>Log out all devices</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loading: { marginTop: 40 },
  error: { color: '#d32f2f', textAlign: 'center', margin: 16, fontSize: 14 },
  list: { padding: 16 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sessionInfo: { flex: 1 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  deviceName: { fontSize: 15, fontWeight: '600', color: '#222', marginRight: 8 },
  currentBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sessionMeta: { fontSize: 13, color: '#888' },
  actionButton: {
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 10,
  },
  logoutButton: { backgroundColor: '#d32f2f' },
  revokeButton: { backgroundColor: '#e0e0e0' },
  actionButtonText: { fontSize: 13, fontWeight: '600', color: '#333' },
  actionButtonTextLight: { color: '#fff' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40 },
  logoutAllButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d32f2f',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutAllButtonText: { color: '#d32f2f', fontWeight: '600', fontSize: 15 },
});
