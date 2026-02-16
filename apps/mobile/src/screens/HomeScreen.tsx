import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import type { MatchHomeItem } from '../types/api';
import { useMatches } from '../features/matches/useMatches';
import { useAuth } from '../contexts/AuthContext';
import { useLogoutOn401 } from '../lib/use-api-query';
import { ApiError } from '../lib/api';
import { apiBaseUrl } from '../config/env';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'HomeTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

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
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, status, fetchStatus, error, refetch } = query;

  // ── Defensive: keep last known data so UI never goes blank ──
  const lastDataRef = useRef(data);
  if (data) lastDataRef.current = data;
  const displayData = data ?? lastDataRef.current;

  // ── Pull-to-refresh: track user-initiated refresh only ──
  // CRITICAL: `refreshing` on FlatList must only be true for user-initiated
  // pull-to-refresh, NOT for background refetches triggered by invalidation.
  // When invalidateQueries fires while this screen is frozen (react-freeze in
  // native stack), the refetch can start/complete while frozen. On unfreeze,
  // setting refreshing=true then immediately false in the same render pass
  // causes the native RefreshControl to get stuck in "refreshing" state.
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsManualRefresh(true);
    refetch();
  }, [refetch]);

  // Clear manual refresh flag when fetching completes
  useEffect(() => {
    if (!isFetching && isManualRefresh) {
      setIsManualRefresh(false);
    }
  }, [isFetching, isManualRefresh]);

  // ── Debounced "Updating…" banner (avoid 1-frame flicker) ──
  const [showUpdating, setShowUpdating] = useState(false);
  const updatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFetching && !isLoading && displayData) {
      updatingTimerRef.current = setTimeout(() => setShowUpdating(true), 250);
    } else {
      if (updatingTimerRef.current) {
        clearTimeout(updatingTimerRef.current);
        updatingTimerRef.current = null;
      }
      setShowUpdating(false);
    }
    return () => {
      if (updatingTimerRef.current) {
        clearTimeout(updatingTimerRef.current);
        updatingTimerRef.current = null;
      }
    };
  }, [isFetching, isLoading, displayData]);

  // ── DEV: detect stuck fetching queries ──
  useEffect(() => {
    if (!__DEV__ || !isFetching) return;

    const timer = setTimeout(() => {
      const cache = queryClient.getQueryCache().getAll();
      const stuck = cache.filter((q) => q.state.fetchStatus === 'fetching');
      if (stuck.length > 0) {
        console.warn(
          '[HomeScreen] Queries still fetching after 5s:',
          stuck.map((q) => ({
            queryKey: q.queryKey,
            status: q.state.status,
            fetchStatus: q.state.fetchStatus,
            failureCount: q.state.fetchFailureCount,
            error: q.state.error?.message ?? null,
          })),
        );
      }
      // Also log pending mutations
      const mutations = queryClient.getMutationCache().getAll();
      const pending = mutations.filter((m) => m.state.status === 'pending');
      if (pending.length > 0) {
        console.warn(
          '[HomeScreen] Pending mutations:',
          pending.map((m) => ({
            mutationKey: m.options.mutationKey,
            status: m.state.status,
          })),
        );
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isFetching, queryClient]);

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
          <Text style={styles.debugText}>
            Q: {status}/{fetchStatus} | data:{data ? 'yes' : 'no'} | items:{displayData?.items?.length ?? '-'} | manualRefresh:{isManualRefresh ? 'Y' : 'N'}
          </Text>
          {error && <Text style={styles.debugText}>Err: {error.message}</Text>}
        </View>
      )}

      {/* Refetch indicator (data visible underneath, debounced 250ms) */}
      {showUpdating && (
        <View style={styles.refreshBanner}>
          <ActivityIndicator size="small" color="#1976d2" />
          <Text style={styles.refreshText}>Updating…</Text>
        </View>
      )}

      {!displayData && isFetching ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : !displayData && error ? (
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
          data={displayData?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MatchRow
              item={item}
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
            />
          )}
          refreshing={isManualRefresh}
          onRefresh={handleRefresh}
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
  refreshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  refreshText: { fontSize: 12, color: '#1976d2' },
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
