import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import type { MatchHomeItem } from '../types/api';
import { useMatches } from '../features/matches/useMatches';
import { useLogoutOn401 } from '../lib/use-api-query';
import { ApiError } from '../lib/api';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'HomeTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

function matchStatusColor(matchStatus: string): string {
  switch (matchStatus) {
    case 'UPCOMING': return '#1976d2';
    case 'PLAYED': return '#757575';
    case 'CANCELLED': return '#d32f2f';
    default: return '#999';
  }
}

function myStatusColor(status: string): string {
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
        <View style={[styles.matchBadge, { backgroundColor: matchStatusColor(item.matchStatus) }]}>
          <Text style={styles.matchBadgeText}>{item.matchStatus}</Text>
        </View>
      </View>
      <Text style={styles.rowSub}>
        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {item.location ? ` \u2022 ${item.location}` : ''}
      </Text>
      <View style={styles.rowFooter}>
        <Text style={styles.rowCount}>
          {item.confirmedCount}/{item.capacity}
        </Text>
        {item.myStatus && (
          <Text style={[styles.rowMyStatus, { color: myStatusColor(item.myStatus) }]}>
            {item.myStatus}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const query = useMatches();
  useLogoutOn401(query);

  const { data, isLoading, isFetching, error, refetch } = query;

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

  // ── Create menu ──
  const handleCreatePress = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Crear partido', 'Crear grupo'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) navigation.navigate('CreateMatch');
          if (buttonIndex === 2) navigation.navigate('CreateGroup');
        },
      );
    } else {
      // Web fallback (debug only)
      navigation.navigate('CreateMatch');
    }
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.headerBtn}
          onPress={handleCreatePress}
          hitSlop={8}
        >
          <Text style={styles.headerBtnPlus}>+</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Matches</Text>

        <Pressable
          style={styles.headerBtn}
          onPress={() => navigation.navigate('Chats')}
          hitSlop={8}
        >
          <Text style={styles.headerBtnChat}>Chats</Text>
        </Pressable>
      </View>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerBtn: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  headerBtnPlus: {
    fontSize: 28,
    fontWeight: '300',
    color: '#1976d2',
    lineHeight: 32,
  },
  headerBtnChat: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1976d2',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
  },
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
  matchBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  matchBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rowSub: { fontSize: 13, color: '#777', marginTop: 4 },
  rowFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  rowCount: { fontSize: 13, color: '#555' },
  rowMyStatus: { fontSize: 12, fontWeight: '600' },
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
});
