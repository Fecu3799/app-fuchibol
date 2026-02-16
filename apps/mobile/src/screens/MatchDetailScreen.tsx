import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import type { MatchSnapshot, ParticipantView, GroupSummary, GroupMember } from '../types/api';
import { useMatch } from '../features/matches/useMatch';
import { useMatchAction, formatActionError } from '../features/matches/useMatchAction';
import {
  useInviteToMatch,
  formatInviteError,
} from '../features/matches/useInviteToMatch';
import {
  useLockMatch,
  useUnlockMatch,
  formatLockError,
} from '../features/matches/useLockMatch';
import {
  useCancelMatch,
  formatCancelError,
} from '../features/matches/useCancelMatch';
import { useLogoutOn401 } from '../lib/use-api-query';
import { ApiError } from '../lib/api';
import { useGroups } from '../features/groups/useGroups';
import { useGroup } from '../features/groups/useGroup';
import { useBatchInviteFromGroup } from '../features/matches/useBatchInviteFromGroup';

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
  const lockMutation = useLockMatch(matchId);
  const unlockMutation = useUnlockMatch(matchId);
  const cancelMutation = useCancelMatch(matchId);
  const [actionError, setActionError] = useState('');
  const [lockError, setLockError] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteMsgType, setInviteMsgType] = useState<'success' | 'error'>(
    'success',
  );

  // Group invite state
  const [showGroupInvite, setShowGroupInvite] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const groupsQuery = useGroups();
  const groupDetailQuery = useGroup(selectedGroupId);
  const batchInviteMutation = useBatchInviteFromGroup(matchId);

  const { data: match, isLoading, isFetching, error, refetch } = query;

  // ── Defensive: keep last known match so UI never goes blank ──
  const lastMatchRef = useRef(match);
  if (match) lastMatchRef.current = match;
  const displayMatch = match ?? lastMatchRef.current;

  // ── Debounced "Updating…" banner (avoid 1-frame flicker) ──
  const [showUpdating, setShowUpdating] = useState(false);
  const updatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFetching && !isLoading && displayMatch) {
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
  }, [isFetching, isLoading, displayMatch]);

  const handleAction = (action: string) => {
    if (!displayMatch) return;
    setActionError('');
    mutation.mutate(
      { action, revision: displayMatch.revision },
      {
        onError: (err) => setActionError(formatActionError(err)),
        onSuccess: () => setActionError(''),
      },
    );
  };

  const handleInvite = () => {
    if (!displayMatch || !inviteInput.trim()) return;
    setInviteMsg('');
    inviteMutation.mutate(
      { identifier: inviteInput.trim(), revision: displayMatch.revision },
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

  const handleLockToggle = () => {
    if (!displayMatch) return;
    setLockError('');
    const m = displayMatch.isLocked ? unlockMutation : lockMutation;
    m.mutate(
      { revision: displayMatch.revision },
      {
        onError: (err) => setLockError(formatLockError(err)),
        onSuccess: () => setLockError(''),
      },
    );
  };

  const handleCancel = () => {
    if (!displayMatch) return;
    Alert.alert(
      'Cancel Match',
      'Are you sure you want to cancel this match? This cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, cancel',
          style: 'destructive',
          onPress: () => {
            setCancelError('');
            cancelMutation.mutate(
              { revision: displayMatch.revision },
              {
                onError: (err) => setCancelError(formatCancelError(err)),
                onSuccess: () => setCancelError(''),
              },
            );
          },
        },
      ],
    );
  };

  // ── Loading (first load only, no data at all) ──
  if (!displayMatch && isFetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ── Error (only when no cached data to show) ──
  if (error && !displayMatch) {
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

  if (!displayMatch) return null;

  const visibleActions = PLAYER_ACTIONS.filter((a) =>
    displayMatch.actionsAllowed.includes(a),
  );
  const canInvite = displayMatch.actionsAllowed.includes('invite');
  const canLock = displayMatch.actionsAllowed.includes('lock');
  const canUnlock = displayMatch.actionsAllowed.includes('unlock');
  const canToggleLock = canLock || canUnlock;
  const canCancel = displayMatch.actionsAllowed.includes('cancel');
  const lockTogglePending = lockMutation.isPending || unlockMutation.isPending;
  const isCanceled = displayMatch.status === 'canceled';
  const groups = deriveParticipantGroups(displayMatch);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Refetch indicator (debounced 250ms) */}
      {showUpdating && (
        <View style={styles.refreshBanner}>
          <ActivityIndicator size="small" color="#1976d2" />
          <Text style={styles.refreshText}>Updating…</Text>
        </View>
      )}

      {/* Header */}
      <Text style={styles.title}>{displayMatch.title}</Text>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{displayMatch.status}</Text>
        </View>
        {displayMatch.isLocked && (
          <View style={[styles.badge, styles.badgeLocked]}>
            <Text style={styles.badgeText}>Locked</Text>
          </View>
        )}
        {displayMatch.myStatus && (
          <View
            style={[
              styles.badge,
              { backgroundColor: STATUS_COLOR[displayMatch.myStatus] ?? '#757575' },
            ]}
          >
            <Text style={styles.badgeText}>
              {STATUS_LABEL[displayMatch.myStatus] ?? displayMatch.myStatus}
            </Text>
          </View>
        )}
      </View>

      {/* Cancelled banner */}
      {isCanceled && (
        <View style={styles.cancelledBanner}>
          <Text style={styles.cancelledBannerText}>This match has been cancelled</Text>
        </View>
      )}

      {/* Lock/Unlock button (admin only, hidden when canceled) */}
      {!isCanceled && canToggleLock && (
        <View style={styles.lockBlock}>
          {lockError ? (
            <Text style={styles.actionError}>{lockError}</Text>
          ) : null}
          <Pressable
            style={[
              styles.lockBtn,
              displayMatch.isLocked ? styles.lockBtnUnlock : styles.lockBtnLock,
              lockTogglePending && styles.btnDisabled,
            ]}
            onPress={handleLockToggle}
            disabled={lockTogglePending}
          >
            {lockTogglePending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.lockBtnText}>
                {displayMatch.isLocked ? 'Unlock Match' : 'Lock Match'}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Match info */}
      <View style={styles.infoBlock}>
        <InfoRow label="Date" value={formatDate(displayMatch.startsAt)} />
        <InfoRow label="Time" value={formatTime(displayMatch.startsAt)} />
        {displayMatch.location && <InfoRow label="Location" value={displayMatch.location} />}
        <InfoRow
          label="Players"
          value={`${displayMatch.confirmedCount} / ${displayMatch.capacity}`}
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

      {/* Locked banner (hidden when canceled) */}
      {!isCanceled && displayMatch.isLocked && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedBannerText}>Match is locked</Text>
        </View>
      )}

      {/* Actions (hidden when locked or canceled) */}
      {!isCanceled && !displayMatch.isLocked && visibleActions.length > 0 && (
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

      {/* Invite block (admin only, hidden when locked or canceled) */}
      {!isCanceled && !displayMatch.isLocked && canInvite && (
        <View style={styles.inviteBlock}>
          <Text style={styles.sectionTitle}>Invite Player</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.inviteInput}
              placeholder="@username or email"
              value={inviteInput}
              onChangeText={(text) => {
                setInviteInput(text);
                if (inviteMsg) setInviteMsg('');
              }}
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

      {/* Invite from Group (admin only, hidden when locked or canceled) */}
      {!isCanceled && !displayMatch.isLocked && canInvite && (
        <View style={styles.groupInviteBlock}>
          {!showGroupInvite ? (
            <Pressable
              style={styles.groupInviteBtn}
              onPress={() => setShowGroupInvite(true)}
            >
              <Text style={styles.groupInviteBtnText}>Invite from Group</Text>
            </Pressable>
          ) : !selectedGroupId ? (
            <View>
              <View style={styles.groupInviteHeader}>
                <Text style={styles.sectionTitle}>Select Group</Text>
                <Pressable onPress={() => setShowGroupInvite(false)}>
                  <Text style={styles.groupCancelText}>Cancel</Text>
                </Pressable>
              </View>
              {groupsQuery.isLoading ? (
                <ActivityIndicator size="small" style={{ marginTop: 12 }} />
              ) : (groupsQuery.data?.owned ?? []).length === 0 ? (
                <Text style={styles.groupEmptyText}>No owned groups</Text>
              ) : (
                (groupsQuery.data?.owned ?? []).map((g) => (
                  <Pressable
                    key={g.id}
                    style={styles.groupOption}
                    onPress={() => {
                      setSelectedGroupId(g.id);
                      setSelectedMembers(new Set());
                    }}
                  >
                    <Text style={styles.groupOptionName}>{g.name}</Text>
                    <Text style={styles.groupOptionCount}>
                      {g.memberCount} members
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          ) : (
            <View>
              <View style={styles.groupInviteHeader}>
                <Text style={styles.sectionTitle}>Select Members</Text>
                <Pressable
                  onPress={() => {
                    setSelectedGroupId('');
                    setSelectedMembers(new Set());
                  }}
                >
                  <Text style={styles.groupCancelText}>Back</Text>
                </Pressable>
              </View>
              {groupDetailQuery.isLoading ? (
                <ActivityIndicator size="small" style={{ marginTop: 12 }} />
              ) : (
                <>
                  {(groupDetailQuery.data?.members ?? []).map((m) => {
                    const isSelected = selectedMembers.has(m.username);
                    return (
                      <Pressable
                        key={m.userId}
                        style={styles.memberCheckRow}
                        onPress={() => {
                          setSelectedMembers((prev) => {
                            const next = new Set(prev);
                            if (isSelected) next.delete(m.username);
                            else next.add(m.username);
                            return next;
                          });
                        }}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            isSelected && styles.checkboxChecked,
                          ]}
                        >
                          {isSelected && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </View>
                        <Text style={styles.memberCheckName}>
                          @{m.username}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    style={[
                      styles.batchInviteBtn,
                      (selectedMembers.size === 0 ||
                        batchInviteMutation.isPending) &&
                        styles.btnDisabled,
                    ]}
                    onPress={() => {
                      if (!displayMatch || selectedMembers.size === 0) return;
                      batchInviteMutation.mutate(
                        {
                          usernames: Array.from(selectedMembers),
                          revision: displayMatch.revision,
                        },
                        {
                          onSuccess: (result) => {
                            const msg =
                              result.failed === 0
                                ? `Invited ${result.successful} player${result.successful !== 1 ? 's' : ''}`
                                : `Invited ${result.successful}/${result.total}. Failed: ${result.errors.map((e) => `@${e.username}`).join(', ')}`;
                            Alert.alert('Invite Results', msg);
                            setShowGroupInvite(false);
                            setSelectedGroupId('');
                            setSelectedMembers(new Set());
                          },
                        },
                      );
                    }}
                    disabled={
                      selectedMembers.size === 0 ||
                      batchInviteMutation.isPending
                    }
                  >
                    {batchInviteMutation.isPending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.batchInviteBtnText}>
                        Invite ({selectedMembers.size})
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {/* Cancel match button (admin only, not already canceled) */}
      {canCancel && (
        <View style={styles.cancelBlock}>
          {cancelError ? (
            <Text style={styles.actionError}>{cancelError}</Text>
          ) : null}
          <Pressable
            style={[styles.cancelBtn, cancelMutation.isPending && styles.btnDisabled]}
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel Match</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Revision footer (debug) */}
      <Text style={styles.revisionText}>rev {displayMatch.revision}</Text>
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
            @{p.username}
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
  refreshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  refreshText: { fontSize: 12, color: '#1976d2' },
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

  // Lock/Unlock
  lockBlock: { marginBottom: 12 },
  lockBtn: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center' as const,
  },
  lockBtnLock: { backgroundColor: '#d32f2f' },
  lockBtnUnlock: { backgroundColor: '#2e7d32' },
  lockBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' as const },

  // Locked banner
  lockedBanner: {
    backgroundColor: '#fce4ec',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center' as const,
  },
  lockedBannerText: { color: '#c62828', fontSize: 13, fontWeight: '600' as const },

  // Cancelled banner
  cancelledBanner: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#bdbdbd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center' as const,
  },
  cancelledBannerText: { color: '#616161', fontSize: 14, fontWeight: '700' as const },

  // Cancel button
  cancelBlock: { marginTop: 20 },
  cancelBtn: {
    backgroundColor: '#b71c1c',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center' as const,
  },
  cancelBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' as const },

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
  participantId: { fontSize: 13, color: '#555' },

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

  // Group invite
  groupInviteBlock: {
    marginTop: 12,
    backgroundColor: '#f5f0ff',
    borderRadius: 10,
    padding: 14,
  },
  groupInviteBtn: {
    backgroundColor: '#7b1fa2',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center' as const,
  },
  groupInviteBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' as const },
  groupInviteHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
  },
  groupCancelText: { color: '#7b1fa2', fontSize: 14, fontWeight: '600' as const },
  groupEmptyText: { color: '#999', fontSize: 14, textAlign: 'center' as const, marginTop: 8 },
  groupOption: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  groupOptionName: { fontSize: 15, fontWeight: '600' as const },
  groupOptionCount: { fontSize: 12, color: '#888', marginTop: 2 },
  memberCheckRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#7b1fa2',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  checkboxChecked: { backgroundColor: '#7b1fa2' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' as const },
  memberCheckName: { fontSize: 14 },
  batchInviteBtn: {
    backgroundColor: '#7b1fa2',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center' as const,
    marginTop: 10,
  },
  batchInviteBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' as const },
});
