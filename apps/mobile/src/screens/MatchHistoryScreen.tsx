import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { MatchHomeItem } from '../types/api';
import { useMatchHistory } from '../features/matches/useMatchHistory';
import { useLogoutOn401 } from '../lib/use-api-query';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'MatchHistory'>;

function statusBadge(item: MatchHomeItem): { label: string; color: string } {
  switch (item.matchStatus) {
    case 'CANCELLED': return { label: 'CANCELLED', color: '#d32f2f' };
    case 'PLAYED': return { label: 'PLAYED', color: '#757575' };
    default: return { label: item.matchStatus, color: '#9e9e9e' };
  }
}

function HistoryRow({ item, onPress }: { item: MatchHomeItem; onPress: () => void }) {
  const date = new Date(item.startsAt);
  const badge = statusBadge(item);

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={[styles.badge, { backgroundColor: badge.color }]}>
          <Text style={styles.badgeText}>{badge.label}</Text>
        </View>
      </View>
      <Text style={styles.rowSub}>
        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {item.location ? ` \u2022 ${item.location}` : ''}
      </Text>
      <Text style={styles.rowCount}>
        {item.confirmedCount}/{item.capacity} confirmed
      </Text>
    </Pressable>
  );
}

export default function MatchHistoryScreen({ navigation }: Props) {
  const query = useMatchHistory();
  useLogoutOn401(query);

  const { data, isLoading, isFetching, error, refetch } = query;

  const lastDataRef = useRef(data);
  if (data) lastDataRef.current = data;
  const displayData = data ?? lastDataRef.current;

  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsManualRefresh(true);
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isFetching && isManualRefresh) {
      setIsManualRefresh(false);
    }
  }, [isFetching, isManualRefresh]);

  return (
    <View style={styles.container}>
      {!displayData && isFetching ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : !displayData && error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load match history</Text>
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
            <HistoryRow
              item={item}
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
            />
          )}
          refreshing={isManualRefresh}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No match history yet</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { marginTop: 40 },
  list: { padding: 12 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  rowSub: { fontSize: 13, color: '#777', marginTop: 4 },
  rowCount: { fontSize: 12, color: '#999', marginTop: 4 },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
