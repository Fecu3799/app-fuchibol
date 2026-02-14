import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import type { MatchSnapshot, ParticipantView } from '../types/api';
import { useMatch } from '../features/matches/useMatch';
import { useMatchAction, formatActionError } from '../features/matches/useMatchAction';
import {
  useInviteToMatch,
  formatInviteError,
} from '../features/matches/useInviteToMatch';
import { useLogoutOn401 } from '../lib/use-api-query';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AppStackParamList, 'MatchDetail'>;

// ── Helpers ──

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  INVITED: 'Pending',
  WAITLISTED: 'Waitlist',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
};

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: '#2e7d32',
  INVITED: '#1976d2',
  WAITLISTED: '#f57c00',
  DECLINED: '#9e9e9e',
  WITHDRAWN: '#bdbdbd',
};

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

const PLAYER_ACTIONS = ['confirm', 'decline', 'withdraw'] as const;

// ── Derived counts from snapshot ──

function deriveParticipantGroups(match: MatchSnapshot) {
  const confirmed: ParticipantView[] = [];
  const invited: ParticipantView[] = [];
  const declined: ParticipantView[] = [];

  for (const p of match.participants) {
    switch (p.status) {
      case 'CONFIRMED':
        confirmed.push(p);
        break;
      case 'INVITED':
        invited.push(p);
        break;
      case 'DECLINED':
        declined.push(p);
        break;
      // WAITLISTED is in match.waitlist separately
    }
  }

  return { confirmed, invited, declined, waitlist: match.waitlist };
}

// ── Component ──

export default function MatchDetailScreen({ route }: Props) {
  const { matchId } = route.params;
  const query = useMatch(matchId);
  useLogoutOn401(query);
  const mutation = useMatchAction(matchId);
  const inviteMutation = useInviteToMatch(matchId);
  const [actionError, setActionError] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteMsgType, setInviteMsgType] = useState<'success' | 'error'>(
    'success',
  );

  const { data: match, isLoading, error, refetch } = query;

  const handleAction = (action: string) => {
    if (!match) return;
    setActionError('');
    mutation.mutate(
      { action, revision: match.revision },
      {
        onError: (err) => setActionError(formatActionError(err)),
        onSuccess: () => setActionError(''),
      },
    );
  };

  const handleInvite = () => {
    if (!match || !inviteInput.trim()) return;
    setInviteMsg('');
    inviteMutation.mutate(
      { identifier: inviteInput.trim(), revision: match.revision },
      {
        onSuccess: () => {
          setInviteMsg('Invite sent!');
          setInviteMsgType('success');
          setInviteInput('');
        },
        onError: (err) => {
          setInviteMsg(formatInviteError(err));
          setInviteMsgType('error');
        },
      },
    );
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ── Error ──
  if (error) {
    const is404 = error instanceof ApiError && error.status === 404;
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {is404 ? 'Match not found' : 'Failed to load match'}
        </Text>
        {error instanceof ApiError && error.requestId && (
          <Text style={styles.requestIdText}>
            RequestId: {error.requestId}
          </Text>
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

  const visibleActions = PLAYER_ACTIONS.filter((a) =>
    match.actionsAllowed.includes(a),
  );
  const canInvite = match.actionsAllowed.includes('invite');
  const groups = deriveParticipantGroups(match);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <Text style={styles.title}>{match.title}</Text>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{match.status}</Text>
        </View>
        {match.isLocked && (
          <View style={[styles.badge, styles.badgeLocked]}>
            <Text style={styles.badgeText}>Locked</Text>
          </View>
        )}
        {match.myStatus && (
          <View
            style={[
              styles.badge,
              { backgroundColor: STATUS_COLOR[match.myStatus] ?? '#757575' },
            ]}
          >
            <Text style={styles.badgeText}>
              {STATUS_LABEL[match.myStatus] ?? match.myStatus}
            </Text>
          </View>
        )}
      </View>

      {/* Match info */}
      <View style={styles.infoBlock}>
        <InfoRow label="Date" value={formatDate(match.startsAt)} />
        <InfoRow label="Time" value={formatTime(match.startsAt)} />
        {match.location && <InfoRow label="Location" value={match.location} />}
        <InfoRow
          label="Players"
          value={`${match.confirmedCount} / ${match.capacity}`}
        />
      </View>

      {/* Counts summary */}
      <View style={styles.countsRow}>
        <CountBadge
          label="Confirmed"
          count={groups.confirmed.length}
          color="#2e7d32"
        />
        <CountBadge
          label="Invited"
          count={groups.invited.length}
          color="#1976d2"
        />
        <CountBadge
          label="Waitlist"
          count={groups.waitlist.length}
          color="#f57c00"
        />
      </View>

      {/* Participant sections */}
      {groups.confirmed.length > 0 && (
        <ParticipantSection
          title="Confirmed"
          color="#2e7d32"
          items={groups.confirmed}
        />
      )}
      {groups.invited.length > 0 && (
        <ParticipantSection
          title="Invited"
          color="#1976d2"
          items={groups.invited}
        />
      )}
      {groups.waitlist.length > 0 && (
        <ParticipantSection
          title="Waitlist"
          color="#f57c00"
          items={groups.waitlist}
          showPosition
        />
      )}
      {groups.declined.length > 0 && (
        <ParticipantSection
          title="Declined"
          color="#9e9e9e"
          items={groups.declined}
        />
      )}

      {/* Actions */}
      {visibleActions.length > 0 && (
        <View style={styles.actions}>
          {actionError ? (
            <Text style={styles.actionError}>{actionError}</Text>
          ) : null}
          <View style={styles.actionRow}>
            {visibleActions.map((action) => (
              <Pressable
                key={action}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: ACTION_COLORS[action] ?? '#1976d2',
                  },
                  mutation.isPending && styles.btnDisabled,
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

      {/* Invite block (admin only, not locked) */}
      {canInvite && (
        <View style={styles.inviteBlock}>
          <Text style={styles.sectionTitle}>Invite Player</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.inviteInput}
              placeholder="@username or email"
              value={inviteInput}
              onChangeText={setInviteInput}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!inviteMutation.isPending}
            />
            <Pressable
              style={[
                styles.inviteBtn,
                (!inviteInput.trim() || inviteMutation.isPending) &&
                  styles.btnDisabled,
              ]}
              onPress={handleInvite}
              disabled={!inviteInput.trim() || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.inviteBtnText}>Invite</Text>
              )}
            </Pressable>
          </View>
          {inviteMsg ? (
            <Text
              style={[
                styles.inviteMsg,
                inviteMsgType === 'error'
                  ? styles.inviteMsgError
                  : styles.inviteMsgSuccess,
              ]}
            >
              {inviteMsg}
            </Text>
          ) : null}
        </View>
      )}

      {/* Revision footer (debug) */}
      <Text style={styles.revisionText}>rev {match.revision}</Text>
    </ScrollView>
  );
}

// ── Subcomponents ──

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function CountBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <View style={styles.countBadge}>
      <Text style={[styles.countNum, { color }]}>{count}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function ParticipantSection({
  title,
  color,
  items,
  showPosition,
}: {
  title: string;
  color: string;
  items: ParticipantView[];
  showPosition?: boolean;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={styles.sectionTitle}>
          {title} ({items.length})
        </Text>
      </View>
      {items.map((p) => (
        <View key={p.userId} style={styles.participantRow}>
          <Text style={styles.participantId} numberOfLines={1}>
            {showPosition && p.waitlistPosition != null
              ? `#${p.waitlistPosition}  `
              : ''}
            {p.userId.slice(0, 8)}...
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },

  // Badges
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  badge: {
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeLocked: { backgroundColor: '#d32f2f' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  // Info block
  infoBlock: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 14, color: '#555' },
  infoValue: { fontSize: 14, fontWeight: '600' },

  // Counts
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  countBadge: { alignItems: 'center' },
  countNum: { fontSize: 22, fontWeight: '700' },
  countLabel: { fontSize: 11, color: '#888', marginTop: 2 },

  // Participant sections
  section: { marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sectionDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  participantRow: {
    paddingVertical: 5,
    paddingHorizontal: 18,
  },
  participantId: { fontSize: 13, color: '#555', fontFamily: 'monospace' },

  // Actions
  actions: { marginTop: 8, marginBottom: 4 },
  actionError: {
    color: '#d32f2f',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Invite
  inviteBlock: {
    marginTop: 20,
    backgroundColor: '#f0f4ff',
    borderRadius: 10,
    padding: 14,
  },
  inviteRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  inviteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  inviteBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  inviteMsg: { marginTop: 8, fontSize: 13, textAlign: 'center' },
  inviteMsgSuccess: { color: '#2e7d32' },
  inviteMsgError: { color: '#d32f2f' },

  // Footer
  revisionText: {
    fontSize: 11,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 20,
  },

  // Error states
  errorText: {
    fontSize: 15,
    color: '#d32f2f',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  requestIdText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#999',
    marginBottom: 8,
  },
});
