import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import type { MatchHomeItem } from '../types/api';
import { useMatches } from '../features/matches/useMatches';
import { useAuth } from '../contexts/AuthContext';
import { useLogoutOn401 } from '../lib/use-api-query';
import { ApiError } from '../lib/api';
import { apiBaseUrl } from '../config/env';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

function statusColor(status: string | null): string {
  switch (status) {
    case 'CONFIRMED': return '#2e7d32';
    case 'WAITLISTED': return '#f57c00';
    case 'INVITED': return '#1976d2';
    case 'DECLINED': return '#9e9e9e';
    default: return '#757575';
  }
}

function MatchRow({ item, onPress }: { item: MatchHomeItem; onPress: () => void }) {
  const date = new Date(item.startsAt);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title}
          {item.isLocked ? ' [Locked]' : ''}
        </Text>
        <Text style={styles.rowCount}>
          {item.confirmedCount}/{item.capacity}
        </Text>
      </View>
      <Text style={styles.rowSub}>
        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {item.location ? ` \u2022 ${item.location}` : ''}
      </Text>
      {item.myStatus && (
        <Text style={[styles.rowStatus, { color: statusColor(item.myStatus) }]}>
          {item.myStatus}
        </Text>
      )}
    </Pressable>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const query = useMatches();
  useLogoutOn401(query);

  const { data, isLoading, error, refetch, isRefetching } = query;

  // TODO: remove debug overlay when no longer needed
  const queryStatus = isLoading ? 'loading' : error ? 'error' : 'success';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>
        <Pressable onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.createBtn}
        onPress={() => navigation.navigate('CreateMatch')}
      >
        <Text style={styles.createBtnText}>+ Create Match</Text>
      </Pressable>

      {/* TODO: remove this debug overlay block */}
      {__DEV__ && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>API: {apiBaseUrl}</Text>
          <Text style={styles.debugText}>Query: {queryStatus}</Text>
          {error && <Text style={styles.debugText}>Error: {error.message}</Text>}
          <Text style={styles.debugText}>Items: {data?.items?.length ?? '-'}</Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load matches</Text>
          {error instanceof ApiError && error.requestId && (
            <Text style={styles.requestIdText}>RequestId: {error.requestId}</Text>
          )}
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MatchRow
              item={item}
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
            />
          )}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No matches yet</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  logoutText: { fontSize: 14, color: '#d32f2f' },
  loader: { marginTop: 40 },
  list: { padding: 12 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  rowCount: { fontSize: 14, color: '#555' },
  rowSub: { fontSize: 13, color: '#777', marginTop: 4 },
  rowStatus: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
  errorContainer: { alignItems: 'center', marginTop: 40 },
  errorText: { fontSize: 15, color: '#d32f2f', marginBottom: 12 },
  retryBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  requestIdText: { fontSize: 11, fontFamily: 'monospace', color: '#999', marginBottom: 8 },
  createBtn: {
    backgroundColor: '#1976d2',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  debugOverlay: {
    backgroundColor: '#fffde7',
    borderBottomWidth: 1,
    borderBottomColor: '#f9a825',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  debugText: { fontSize: 11, fontFamily: 'monospace', color: '#555' },
});
