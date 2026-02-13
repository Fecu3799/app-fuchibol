import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { useMatch } from '../features/matches/useMatch';
import { useMatchAction, formatActionError } from '../features/matches/useMatchAction';
import { useLogoutOn401 } from '../lib/use-api-query';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AppStackParamList, 'MatchDetail'>;

const PLAYER_ACTIONS = ['confirm', 'decline', 'withdraw'] as const;

const ACTION_LABELS: Record<string, string> = {
  confirm: 'Confirm',
  decline: 'Decline',
  withdraw: 'Withdraw',
};

const ACTION_COLORS: Record<string, string> = {
  confirm: '#2e7d32',
  decline: '#757575',
  withdraw: '#d32f2f',
};

export default function MatchDetailScreen({ route }: Props) {
  const { matchId } = route.params;
  const query = useMatch(matchId);
  useLogoutOn401(query);
  const mutation = useMatchAction(matchId);
  const [actionError, setActionError] = useState('');

  const { data: match, isLoading, error, refetch } = query;

  const handleAction = (action: string) => {
    if (!match) return;
    setActionError('');
    mutation.mutate(
      { action, revision: match.revision },
      {
        onError: (err) => {
          setActionError(formatActionError(err));
        },
        onSuccess: () => {
          setActionError('');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    const is404 = error instanceof ApiError && error.status === 404;
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {is404 ? 'Match not found' : 'Failed to load match'}
        </Text>
        {error instanceof ApiError && error.requestId && (
          <Text style={styles.requestIdText}>RequestId: {error.requestId}</Text>
        )}
        {!is404 && (
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!match) return null;

  const date = new Date(match.startsAt);
  const visibleActions = PLAYER_ACTIONS.filter((a) => match.actionsAllowed.includes(a));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{match.title}</Text>
      <Text style={styles.status}>
        {match.status}{match.isLocked ? ' (Locked)' : ''}
      </Text>

      <View style={styles.infoBlock}>
        <InfoRow label="Date" value={date.toLocaleDateString()} />
        <InfoRow
          label="Time"
          value={date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        />
        {match.location && <InfoRow label="Location" value={match.location} />}
        <InfoRow label="Players" value={`${match.confirmedCount} / ${match.capacity}`} />
        {match.myStatus && <InfoRow label="My Status" value={match.myStatus} />}
        {match.participants.length > 0 && (
          <InfoRow label="Participants" value={String(match.participants.length)} />
        )}
        {match.waitlist.length > 0 && (
          <InfoRow label="Waitlist" value={String(match.waitlist.length)} />
        )}
        <InfoRow label="Revision" value={String(match.revision)} />
      </View>

      {visibleActions.length > 0 && (
        <View style={styles.actions}>
          {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
          <View style={styles.actionRow}>
            {visibleActions.map((action) => (
              <Pressable
                key={action}
                style={[
                  styles.actionBtn,
                  { backgroundColor: ACTION_COLORS[action] ?? '#1976d2' },
                  mutation.isPending && styles.actionBtnDisabled,
                ]}
                onPress={() => handleAction(action)}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionBtnText}>
                    {ACTION_LABELS[action] ?? action}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  status: { fontSize: 14, color: '#666', marginBottom: 20 },
  infoBlock: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 14, color: '#555' },
  infoValue: { fontSize: 14, fontWeight: '600' },
  errorText: { fontSize: 15, color: '#d32f2f', marginBottom: 12, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  requestIdText: { fontSize: 11, fontFamily: 'monospace', color: '#999', marginBottom: 8 },
  actions: { marginTop: 4 },
  actionError: { color: '#d32f2f', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
