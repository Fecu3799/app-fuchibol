import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import type {
  MatchSnapshot,
  ParticipantView,
  SpectatorView,
  GroupSummary,
  AuditLogEntry,
  InviteCandidate,
} from "../types/api";
import { useMatch } from "../features/matches/useMatch";
import { useMatchRealtime } from "../features/matches/useMatchRealtime";
import {
  useMatchAction,
  formatActionError,
} from "../features/matches/useMatchAction";
import { useMatchUxSignals } from "../features/matches/useMatchUxSignals";
import { MatchBanner } from "../components/MatchBanner";
import {
  useInviteToMatch,
  formatInviteError,
} from "../features/matches/useInviteToMatch";
import {
  useLockMatch,
  useUnlockMatch,
  formatLockError,
} from "../features/matches/useLockMatch";
import {
  useCancelMatch,
  formatCancelError,
} from "../features/matches/useCancelMatch";
import { useLogoutOn401 } from "../lib/use-api-query";
import { ApiError } from "../lib/api";
import { useGroups } from "../features/groups/useGroups";
import { useBatchInviteFromGroup } from "../features/matches/useBatchInviteFromGroup";
import { useInviteCandidates } from "../features/matches/useInviteCandidates";
import { useMatchAuditLogs } from "../features/matches/useMatchAuditLogs";
import {
  postMatchAction,
  promoteAdmin,
  demoteAdmin,
  kickParticipant,
} from "../features/matches/matchesClient";
import { randomUUID } from "expo-crypto";
import { useAuth } from "../contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

type Props = NativeStackScreenProps<RootStackParamList, "MatchDetail">;

// ── Helpers ──

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmed",
  INVITED: "Pending",
  WAITLISTED: "Waitlist",
  SPECTATOR: "Spectator",
};

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: "#2e7d32",
  INVITED: "#1976d2",
  WAITLISTED: "#f57c00",
  SPECTATOR: "#6d4c41",
};

const MATCH_GENDER_LABEL: Record<string, string> = {
  MASCULINO: "Masculino",
  FEMENINO: "Femenino",
  MIXTO: "Mixto",
  SIN_DEFINIR: "—",
};

const ACTION_LABELS: Record<string, string> = {
  confirm: "Confirm",
  reject: "Rechazar",
};

const ACTION_COLORS: Record<string, string> = {
  confirm: "#2e7d32",
  reject: "#757575",
};

const PLAYER_ACTIONS = ["confirm", "reject"] as const;

const CANDIDATE_STATUS_COLOR: Record<string, string> = {
  CONFIRMED: "#2e7d32",
  INVITED: "#1976d2",
  WAITLISTED: "#f57c00",
  SPECTATOR: "#6d4c41",
};

const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmado",
  INVITED: "Invitado",
  WAITLISTED: "En espera",
  SPECTATOR: "Espectador",
};

// ── Derived counts from snapshot ──

function deriveParticipantGroups(match: MatchSnapshot) {
  const confirmed: ParticipantView[] = [];
  const invited: ParticipantView[] = [];

  for (const p of match.participants) {
    switch (p.status) {
      case "CONFIRMED":
        confirmed.push(p);
        break;
      case "INVITED":
        invited.push(p);
        break;
      // WAITLISTED is in match.waitlist; SPECTATOR is in match.spectators
    }
  }

  return {
    confirmed,
    invited,
    waitlist: match.waitlist,
    spectators: match.spectators ?? [],
  };
}

// ── Audit log formatter ──

function formatAuditLog(entry: AuditLogEntry): string {
  const who = entry.actor?.username ? `@${entry.actor.username}` : "Alguien";
  const time = new Date(entry.createdAt).toLocaleString("es-AR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const meta = entry.metadata as Record<string, unknown>;
  switch (entry.type) {
    case "match.locked":
      return `${time} — ${who} bloqueó el partido`;
    case "match.unlocked":
      return `${time} — ${who} desbloqueó el partido`;
    case "match.canceled":
      return `${time} — ${who} canceló el partido`;
    case "match.updated_major":
      return `${time} — ${who} actualizó el partido (${(meta.fieldsChanged as string[])?.join(", ")})`;
    case "participant.confirmed":
      return `${time} — ${who} confirmó (${meta.newStatus ?? "CONFIRMED"})`;
    case "participant.declined":
      return `${time} — ${who} declinó`;
    case "participant.left":
      return `${time} — ${who} abandonó el partido`;
    case "participant.spectator_on":
      return `${time} — ${who} pasó a espectador`;
    case "participant.spectator_off":
      return `${time} — ${who} volvió como participante`;
    case "waitlist.promoted":
      return `${time} — ${who} promovió a alguien de la lista de espera`;
    case "invite.sent":
      return `${time} — ${who} invitó a un jugador`;
    case "invite.rejected":
      return `${time} — ${who} rechazó la invitación`;
    case "admin.promoted":
      return `${time} — ${who} promovió a un admin`;
    case "admin.demoted":
      return `${time} — ${who} quitó admin`;
    default:
      return `${time} — ${entry.type}`;
  }
}

// ── DEV logger hook ──

function useDevMatchLogger() {
  const countRef = useRef(0);
  const [devStats, setDevStats] = useState<{
    count: number;
    lastSources: string[];
  }>({ count: 0, lastSources: [] });

  const devLog = (source: string) => {
    if (!__DEV__) return;
    countRef.current += 1;
    const count = countRef.current;
    setDevStats((prev) => ({
      count,
      lastSources: [...prev.lastSources.slice(-4), source],
    }));
  };

  return { devStats, devLog };
}

// ── Countdown helper ──

function computeCountdown(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "";
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${p(hrs)}h ${p(mins)}m`;
  return `${p(hrs)}h ${p(mins)}m ${p(secs)}s`;
}

// ── Component ──

export default function MatchDetailScreen({ route, navigation }: Props) {
  const { matchId } = route.params;
  const query = useMatch(matchId);
  useLogoutOn401(query);
  const { devStats, devLog } = useDevMatchLogger();
  const { wsConnected } = useMatchRealtime(matchId, query.data?.revision, devLog);
  const mutation = useMatchAction(matchId);
  const inviteMutation = useInviteToMatch(matchId);
  const lockMutation = useLockMatch(matchId);
  const unlockMutation = useUnlockMatch(matchId);
  const cancelMutation = useCancelMatch(matchId);
  const [actionError, setActionError] = useState("");
  const [lockError, setLockError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteMsgType, setInviteMsgType] = useState<"success" | "error">(
    "success",
  );

  // Group invite state
  const [showGroupInvite, setShowGroupInvite] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(),
  );
  const groupsQuery = useGroups();
  const candidatesQuery = useInviteCandidates(matchId, selectedGroupId || null);
  const batchInviteMutation = useBatchInviteFromGroup(matchId, {
    onQueryInvalidated: () => devLog("afterMutation"),
  });

  const [actividadExpanded, setActividadExpanded] = useState(false);
  const auditLogs = useMatchAuditLogs(matchId, { enabled: actividadExpanded });

  const { token, logout } = useAuth();
  const qc = useQueryClient();
  const { data: match, isLoading, isFetching, error, refetch } = query;

  // ── Defensive: keep last known match so UI never goes blank ──
  const lastMatchRef = useRef(match);
  if (match) lastMatchRef.current = match;
  const displayMatch = match ?? lastMatchRef.current;

  // ── UX signals: banner ──
  const { banner, dismissPromoted } = useMatchUxSignals(
    displayMatch,
    wsConnected,
  );

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

  useEffect(() => {
    if (!__DEV__) return;
    console.log(`[MatchDetail] isFetching=${isFetching} count=${devStats.count}`);
  }, [isFetching, devStats.count]);

  const startsAtStr = displayMatch?.startsAt ?? null;
  useEffect(() => {
    if (!startsAtStr) { setCountdown(""); return; }
    const update = () => setCountdown(computeCountdown(startsAtStr));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startsAtStr]);

  const handleAction = (action: string) => {
    if (!displayMatch) return;
    if (action === "reject") {
      void doReject();
      return;
    }
    setActionError("");
    mutation.mutate(
      { action, revision: displayMatch.revision },
      {
        onError: (err) => setActionError(formatActionError(err)),
        onSuccess: () => setActionError(""),
      },
    );
  };

  const handleInvite = () => {
    if (!displayMatch || !inviteInput.trim()) return;
    setInviteMsg("");
    inviteMutation.mutate(
      { identifier: inviteInput.trim(), revision: displayMatch.revision },
      {
        onSuccess: () => {
          setInviteMsg("Invite sent!");
          setInviteMsgType("success");
          setInviteInput("");
        },
        onError: (err) => {
          setInviteMsg(formatInviteError(err));
          setInviteMsgType("error");
        },
      },
    );
  };

  const handleLockToggle = () => {
    if (!displayMatch) return;
    setLockError("");
    const m = displayMatch.isLocked ? unlockMutation : lockMutation;
    m.mutate(
      { revision: displayMatch.revision },
      {
        onError: (err) => setLockError(formatLockError(err)),
        onSuccess: () => setLockError(""),
      },
    );
  };

  const handleCancel = () => {
    if (!displayMatch) return;
    Alert.alert(
      "Cancel Match",
      "Are you sure you want to cancel this match? This cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: () => {
            setCancelError("");
            cancelMutation.mutate(
              { revision: displayMatch.revision },
              {
                onError: (err) => setCancelError(formatCancelError(err)),
                onSuccess: () => setCancelError(""),
              },
            );
          },
        },
      ],
    );
  };

  const [kickLoading, setKickLoading] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [spectatorLoading, setSpectatorLoading] = useState(false);
  const [spectatorError, setSpectatorError] = useState("");
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  const handleSpectatorToggle = async () => {
    if (!displayMatch || !token) return;
    setSpectatorError("");
    setSpectatorLoading(true);
    try {
      await postMatchAction(
        token,
        matchId,
        "spectator",
        displayMatch.revision,
        randomUUID(),
      );
      devLog("afterMutation");
      qc.invalidateQueries({ queryKey: ["match", matchId] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setSpectatorError(formatActionError(err));
    } finally {
      setSpectatorLoading(false);
    }
  };

  const doLeave = async () => {
    if (!displayMatch || !token) return;
    setLeaveError("");
    setLeaveLoading(true);
    try {
      await postMatchAction(
        token,
        matchId,
        "leave",
        displayMatch.revision,
        randomUUID(),
      );
      qc.invalidateQueries({ queryKey: ["matches"] });
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      if (
        err instanceof ApiError &&
        err.code === "CREATOR_TRANSFER_REQUIRED"
      ) {
        setLeaveError("You must promote an admin before leaving as creator.");
      } else {
        setLeaveError(formatActionError(err));
      }
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleLeave = () => {
    if (!displayMatch || !token) return;
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to leave this match?")) {
        void doLeave();
      }
    } else {
      Alert.alert(
        "Leave Match",
        "Are you sure you want to leave this match?",
        [
          { text: "No", style: "cancel" },
          { text: "Yes, leave", style: "destructive", onPress: doLeave },
        ],
      );
    }
  };

  const doReject = async () => {
    if (!displayMatch || !token) return;
    setActionError("");
    setRejectLoading(true);
    try {
      await postMatchAction(token, matchId, "reject", displayMatch.revision, randomUUID());
      qc.invalidateQueries({ queryKey: ["matches"] });
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setActionError(formatActionError(err));
    } finally {
      setRejectLoading(false);
    }
  };

  const handlePromote = async (targetUserId: string, username: string) => {
    if (!displayMatch || !token) return;
    setAdminActionLoading(true);
    try {
      await promoteAdmin(token, matchId, targetUserId, displayMatch.revision);
      devLog("afterMutation");
      qc.invalidateQueries({ queryKey: ["match", matchId] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      Alert.alert("Error", formatActionError(err));
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleDemote = async (targetUserId: string, username: string) => {
    if (!displayMatch || !token) return;
    setAdminActionLoading(true);
    try {
      await demoteAdmin(token, matchId, targetUserId, displayMatch.revision);
      devLog("afterMutation");
      qc.invalidateQueries({ queryKey: ["match", matchId] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      Alert.alert("Error", formatActionError(err));
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleKick = (targetUserId: string, username: string) => {
    if (!displayMatch || !token) return;
    const doKick = async () => {
      setKickLoading(true);
      try {
        const snapshot = await kickParticipant(
          token,
          matchId,
          targetUserId,
          displayMatch.revision,
        );
        qc.setQueryData(["match", matchId], { match: snapshot });
        qc.invalidateQueries({ queryKey: ["matches"] });
        if (selectedGroupId) {
          qc.invalidateQueries({
            queryKey: ["invite-candidates", matchId, selectedGroupId],
          });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          return;
        }
        Alert.alert("Error", formatActionError(err));
      } finally {
        setKickLoading(false);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`¿Expulsar a @${username}?`)) void doKick();
    } else {
      Alert.alert(
        "Expulsar",
        `¿Expulsar a @${username}?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Expulsar", style: "destructive", onPress: doKick },
        ],
      );
    }
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
          {is404 ? "Match not found" : "Failed to load match"}
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

  if (!displayMatch) return null;

  const isSpectator = displayMatch.myStatus === "SPECTATOR";
  // When SPECTATOR: hide confirm/reject (not a real participant)
  const visibleActions = PLAYER_ACTIONS.filter(
    (a) => displayMatch.actionsAllowed.includes(a) && !isSpectator,
  );
  const canSpectator = displayMatch.actionsAllowed.includes("spectator");
  const canInvite = displayMatch.actionsAllowed.includes("invite");
  const canLock = displayMatch.actionsAllowed.includes("lock");
  const canUnlock = displayMatch.actionsAllowed.includes("unlock");
  const canToggleLock = canLock || canUnlock;
  const canCancel = displayMatch.actionsAllowed.includes("cancel");
  const canEdit = displayMatch.actionsAllowed.includes("update");
  const canLeave = displayMatch.actionsAllowed.includes("leave");
  const canManageAdmins = displayMatch.actionsAllowed.includes("manage_admins");
  const lockTogglePending = lockMutation.isPending || unlockMutation.isPending;
  const isCanceled = displayMatch.status === "canceled";
  const canKick = !isCanceled && displayMatch.actionsAllowed.includes("manage_kick");
  const groups = deriveParticipantGroups(displayMatch);

  return (
    <View style={styles.screenWrap}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* DEV-only GET counter badge */}
      {__DEV__ && (
        <View style={styles.devBadge}>
          <Text style={styles.devBadgeText}>
            GET count: {devStats.count}{"  "}[{devStats.lastSources.join(", ")}]
          </Text>
        </View>
      )}

      {/* Refetch indicator (debounced 250ms) */}
      {showUpdating && (
        <View style={styles.refreshBanner}>
          <ActivityIndicator size="small" color="#1976d2" />
          <Text style={styles.refreshText}>Updating…</Text>
        </View>
      )}

      {/* Persistent banner (canceled / reconfirm / promoted / reconnecting) */}
      {banner && (
        <MatchBanner
          banner={banner}
          onDismiss={banner.type === "promoted" ? dismissPromoted : undefined}
        />
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
              {
                backgroundColor:
                  STATUS_COLOR[displayMatch.myStatus] ?? "#757575",
              },
            ]}
          >
            <Text style={styles.badgeText}>
              {STATUS_LABEL[displayMatch.myStatus] ?? displayMatch.myStatus}
            </Text>
          </View>
        )}
      </View>

      {/* Edit Match button (creator only, hidden when canceled) */}
      {!isCanceled && canEdit && (
        <Pressable
          style={styles.editBtn}
          onPress={() => navigation.navigate("EditMatch", { matchId })}
        >
          <Text style={styles.editBtnText}>Edit Match</Text>
        </Pressable>
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
                {displayMatch.isLocked ? "Unlock Match" : "Lock Match"}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Match info */}
      <View style={styles.infoBlock}>
        {countdown ? <InfoRow label="Starts in" value={countdown} /> : null}
        <InfoRow label="Date" value={formatDate(displayMatch.startsAt)} />
        <InfoRow label="Time" value={formatTime(displayMatch.startsAt)} />
        {displayMatch.location && (
          <InfoRow label="Location" value={displayMatch.location} />
        )}
        <InfoRow
          label="Players"
          value={`${displayMatch.confirmedCount} / ${displayMatch.capacity}`}
        />
        <InfoRow
          label="Género"
          value={MATCH_GENDER_LABEL[displayMatch.matchGender] ?? "—"}
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
        <CountBadge
          label="Spectators"
          count={displayMatch.spectatorCount ?? 0}
          color="#6d4c41"
        />
      </View>

      {/* Participant sections */}
      {groups.confirmed.length > 0 && (
        <ParticipantSection
          title="Confirmed"
          color="#2e7d32"
          items={groups.confirmed}
          creatorId={displayMatch.createdById}
          canManageAdmins={canManageAdmins}
          adminActionLoading={adminActionLoading}
          onPromote={handlePromote}
          onDemote={handleDemote}
          canKick={canKick}
          kickLoading={kickLoading}
          onKick={handleKick}
        />
      )}
      <OthersSection
        waitlist={groups.waitlist}
        invited={groups.invited}
        spectators={groups.spectators}
        creatorId={displayMatch.createdById}
        canManageAdmins={canManageAdmins}
        adminActionLoading={adminActionLoading}
        onPromote={handlePromote}
        onDemote={handleDemote}
        canKick={canKick}
        kickLoading={kickLoading}
        onKick={handleKick}
      />

      {/* Locked banner (hidden when canceled) */}
      {!isCanceled && displayMatch.isLocked && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedBannerText}>Match is locked</Text>
        </View>
      )}

      {/* Actions: Confirm / Decline (hidden when canceled or spectator; confirm still shown for INVITED when locked) */}
      {!isCanceled && visibleActions.length > 0 && (
        <View style={styles.actions}>
          {actionError ? (
            <Text style={styles.actionError}>{actionError}</Text>
          ) : null}
          <View style={styles.actionRow}>
            {visibleActions.map((action) => {
              const isThisLoading = action === "reject" ? rejectLoading : mutation.isPending;
              const isAnyLoading = mutation.isPending || rejectLoading;
              return (
                <Pressable
                  key={action}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: ACTION_COLORS[action] ?? "#1976d2" },
                    isAnyLoading && styles.btnDisabled,
                  ]}
                  onPress={() => handleAction(action)}
                  disabled={isAnyLoading}
                >
                  {isThisLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.actionBtnText}>
                      {ACTION_LABELS[action] ?? action}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Spectator toggle button (hidden when canceled) */}
      {!isCanceled && canSpectator && (
        <View style={styles.spectatorBlock}>
          {spectatorError ? (
            <Text style={styles.actionError}>{spectatorError}</Text>
          ) : null}
          <Pressable
            style={[
              styles.spectatorBtn,
              spectatorLoading && styles.btnDisabled,
            ]}
            onPress={handleSpectatorToggle}
            disabled={spectatorLoading}
          >
            {spectatorLoading ? (
              <ActivityIndicator color="#6d4c41" size="small" />
            ) : (
              <Text style={styles.spectatorBtnText}>
                {isSpectator ? "Participate" : "Spectator"}
              </Text>
            )}
          </Pressable>
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
                if (inviteMsg) setInviteMsg("");
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
                inviteMsgType === "error"
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
              ) : (() => {
                const allGroups = [
                  ...(groupsQuery.data?.owned ?? []),
                  ...(groupsQuery.data?.memberOf ?? []),
                ].filter(
                  (g, i, arr) => arr.findIndex((x) => x.id === g.id) === i,
                );
                return allGroups.length === 0 ? (
                  <Text style={styles.groupEmptyText}>No groups</Text>
                ) : (
                  allGroups.map((g) => (
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
                );
              })()}
            </View>
          ) : (
            <View>
              <View style={styles.groupInviteHeader}>
                <Text style={styles.sectionTitle}>Select Members</Text>
                <Pressable
                  onPress={() => {
                    setSelectedGroupId("");
                    setSelectedMembers(new Set());
                  }}
                >
                  <Text style={styles.groupCancelText}>Back</Text>
                </Pressable>
              </View>
              {candidatesQuery.isLoading ? (
                <ActivityIndicator size="small" style={{ marginTop: 12 }} />
              ) : (
                <>
                  {(candidatesQuery.data?.candidates ?? []).map(
                    (c: InviteCandidate) => {
                      const isSelected = selectedMembers.has(c.username);
                      const isDisabled =
                        !c.canInvite || batchInviteMutation.isPending;
                      return (
                        <Pressable
                          key={c.userId}
                          style={[
                            styles.memberCheckRow,
                            isDisabled && { opacity: 0.5 },
                          ]}
                          onPress={() => {
                            if (!c.canInvite) return;
                            setSelectedMembers((prev) => {
                              const next = new Set(prev);
                              if (isSelected) next.delete(c.username);
                              else next.add(c.username);
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
                            @{c.username}
                          </Text>
                          {c.matchStatus !== "NONE" && (
                            <View
                              style={[
                                styles.statusChip,
                                {
                                  backgroundColor:
                                    CANDIDATE_STATUS_COLOR[c.matchStatus] ??
                                    "#999",
                                },
                              ]}
                            >
                              <Text style={styles.statusChipText}>
                                {CANDIDATE_STATUS_LABEL[c.matchStatus] ??
                                  c.matchStatus}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    },
                  )}
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
                                ? `Invited ${result.successful} player${result.successful !== 1 ? "s" : ""}`
                                : `Invited ${result.successful}/${result.total}. Failed: ${result.errors.map((e) => `@${e.username}`).join(", ")}`;
                            Alert.alert("Invite Results", msg);
                            setShowGroupInvite(false);
                            setSelectedGroupId("");
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
      {/* Actividad section */}
      <View style={styles.actividadBlock}>
        <Pressable
          style={styles.actividadHeader}
          onPress={() => setActividadExpanded((v) => !v)}
        >
          <Text style={styles.actividadTitle}>
            Actividad {actividadExpanded ? "▼" : "▶"}
          </Text>
        </Pressable>
        {actividadExpanded && (
          <>
            {auditLogs.isLoading ? (
              <ActivityIndicator size="small" style={{ marginTop: 8 }} />
            ) : auditLogs.entries.length === 0 ? (
              <Text style={styles.actividadEmpty}>Sin actividad registrada</Text>
            ) : (
              <>
                {auditLogs.entries.map((entry) => (
                  <Text key={entry.id} style={styles.actividadEntry}>
                    {formatAuditLog(entry)}
                  </Text>
                ))}
                {auditLogs.hasNextPage && (
                  <Pressable
                    style={styles.actividadMore}
                    onPress={auditLogs.fetchNextPage}
                    disabled={auditLogs.isFetchingNextPage}
                  >
                    <Text style={styles.actividadMoreText}>
                      {auditLogs.isFetchingNextPage ? "Cargando…" : "Cargar más"}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </>
        )}
      </View>

      {/* Leave match button */}
      {!isCanceled && canLeave && (
        <View style={styles.leaveBlock}>
          {leaveError ? (
            <Text style={styles.actionError}>{leaveError}</Text>
          ) : null}
          <Pressable
            style={[styles.leaveBtn, leaveLoading && styles.btnDisabled]}
            onPress={handleLeave}
            disabled={leaveLoading}
          >
            {leaveLoading ? (
              <ActivityIndicator color="#d32f2f" size="small" />
            ) : (
              <Text style={styles.leaveBtnText}>Leave Match</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Cancel match button (admin only, not already canceled) */}
      {canCancel && (
        <View style={styles.cancelBlock}>
          {cancelError ? (
            <Text style={styles.actionError}>{cancelError}</Text>
          ) : null}
          <Pressable
            style={[
              styles.cancelBtn,
              cancelMutation.isPending && styles.btnDisabled,
            ]}
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

    </ScrollView>
    </View>
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
  creatorId,
  canManageAdmins,
  adminActionLoading,
  onPromote,
  onDemote,
  canKick,
  kickLoading,
  onKick,
}: {
  title: string;
  color: string;
  items: ParticipantView[];
  showPosition?: boolean;
  creatorId?: string;
  canManageAdmins?: boolean;
  adminActionLoading?: boolean;
  onPromote?: (userId: string, username: string) => void;
  onDemote?: (userId: string, username: string) => void;
  canKick?: boolean;
  kickLoading?: boolean;
  onKick?: (userId: string, username: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={styles.sectionTitle}>
          {title} ({items.length})
        </Text>
      </View>
      {items.map((p) => {
        const isCreator = p.userId === creatorId;
        return (
          <View key={p.userId} style={styles.participantRow}>
            <View style={styles.participantInfo}>
              <Text style={styles.participantId} numberOfLines={1}>
                {showPosition && p.waitlistPosition != null
                  ? `#${p.waitlistPosition}  `
                  : ""}
                @{p.username}
              </Text>
              {isCreator && (
                <View style={[styles.roleBadge, styles.roleBadgeCreator]}>
                  <Text style={styles.roleBadgeText}>Creator</Text>
                </View>
              )}
              {!isCreator && p.isMatchAdmin && (
                <View style={[styles.roleBadge, styles.roleBadgeAdmin]}>
                  <Text style={styles.roleBadgeText}>Admin</Text>
                </View>
              )}
            </View>
            {canManageAdmins && !isCreator && (
              <Pressable
                style={[
                  styles.adminToggleBtn,
                  p.isMatchAdmin
                    ? styles.adminToggleDemote
                    : styles.adminTogglePromote,
                  adminActionLoading && styles.btnDisabled,
                ]}
                onPress={() =>
                  p.isMatchAdmin
                    ? onDemote?.(p.userId, p.username)
                    : onPromote?.(p.userId, p.username)
                }
                disabled={adminActionLoading}
              >
                <Text style={styles.adminToggleText}>
                  {p.isMatchAdmin ? "Remove admin" : "Make admin"}
                </Text>
              </Pressable>
            )}
            {canKick && !isCreator && (
              <Pressable
                style={[styles.kickBtn, kickLoading && styles.btnDisabled]}
                onPress={() => onKick?.(p.userId, p.username)}
                disabled={kickLoading}
              >
                <Text style={styles.kickBtnText}>Expulsar</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

function OthersSection({
  waitlist,
  invited,
  spectators,
  creatorId,
  canManageAdmins,
  adminActionLoading,
  onPromote,
  onDemote,
  canKick,
  kickLoading,
  onKick,
}: {
  waitlist: ParticipantView[];
  invited: ParticipantView[];
  spectators: SpectatorView[];
  creatorId?: string;
  canManageAdmins?: boolean;
  adminActionLoading?: boolean;
  onPromote?: (userId: string, username: string) => void;
  onDemote?: (userId: string, username: string) => void;
  canKick?: boolean;
  kickLoading?: boolean;
  onKick?: (userId: string, username: string) => void;
}) {
  const total = waitlist.length + invited.length + spectators.length;
  if (total === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: "#757575" }]} />
        <Text style={styles.sectionTitle}>Others ({total})</Text>
      </View>
      {waitlist.map((p) => (
        <OthersParticipantRow
          key={p.userId}
          participant={p}
          badgeLabel="Waitlist"
          badgeColor="#f57c00"
          creatorId={creatorId}
          canManageAdmins={canManageAdmins}
          adminActionLoading={adminActionLoading}
          onPromote={onPromote}
          onDemote={onDemote}
          canKick={canKick}
          kickLoading={kickLoading}
          onKick={onKick}
        />
      ))}
      {invited.map((p) => (
        <OthersParticipantRow
          key={p.userId}
          participant={p}
          badgeLabel="Invited"
          badgeColor="#1976d2"
          creatorId={creatorId}
          canManageAdmins={canManageAdmins}
          adminActionLoading={adminActionLoading}
          onPromote={onPromote}
          onDemote={onDemote}
          canKick={canKick}
          kickLoading={kickLoading}
          onKick={onKick}
        />
      ))}
      {spectators.map((s) => (
        <View key={s.userId} style={styles.participantRow}>
          <View style={styles.participantInfo}>
            <Text style={styles.participantId}>@{s.username}</Text>
            <View style={[styles.statusChip, { backgroundColor: "#6d4c41" }]}>
              <Text style={styles.statusChipText}>Spectator</Text>
            </View>
          </View>
          {canKick && s.userId !== creatorId && (
            <Pressable
              style={[styles.kickBtn, kickLoading && styles.btnDisabled]}
              onPress={() => onKick?.(s.userId, s.username)}
              disabled={kickLoading}
            >
              <Text style={styles.kickBtnText}>Expulsar</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

function OthersParticipantRow({
  participant: p,
  badgeLabel,
  badgeColor,
  creatorId,
  canManageAdmins,
  adminActionLoading,
  onPromote,
  onDemote,
  canKick,
  kickLoading,
  onKick,
}: {
  participant: ParticipantView;
  badgeLabel: string;
  badgeColor: string;
  creatorId?: string;
  canManageAdmins?: boolean;
  adminActionLoading?: boolean;
  onPromote?: (userId: string, username: string) => void;
  onDemote?: (userId: string, username: string) => void;
  canKick?: boolean;
  kickLoading?: boolean;
  onKick?: (userId: string, username: string) => void;
}) {
  const isCreator = p.userId === creatorId;
  return (
    <View style={styles.participantRow}>
      <View style={styles.participantInfo}>
        <Text style={styles.participantId}>
          {p.waitlistPosition != null ? `#${p.waitlistPosition}  ` : ""}
          @{p.username}
        </Text>
        <View style={[styles.statusChip, { backgroundColor: badgeColor }]}>
          <Text style={styles.statusChipText}>{badgeLabel}</Text>
        </View>
        {isCreator && (
          <View style={[styles.roleBadge, styles.roleBadgeCreator]}>
            <Text style={styles.roleBadgeText}>Creator</Text>
          </View>
        )}
        {!isCreator && p.isMatchAdmin && (
          <View style={[styles.roleBadge, styles.roleBadgeAdmin]}>
            <Text style={styles.roleBadgeText}>Admin</Text>
          </View>
        )}
      </View>
      {canManageAdmins && !isCreator && (
        <Pressable
          style={[
            styles.adminToggleBtn,
            p.isMatchAdmin ? styles.adminToggleDemote : styles.adminTogglePromote,
            adminActionLoading && styles.btnDisabled,
          ]}
          onPress={() =>
            p.isMatchAdmin
              ? onDemote?.(p.userId, p.username)
              : onPromote?.(p.userId, p.username)
          }
          disabled={adminActionLoading}
        >
          <Text style={styles.adminToggleText}>
            {p.isMatchAdmin ? "Remove admin" : "Make admin"}
          </Text>
        </Pressable>
      )}
      {canKick && !isCreator && (
        <Pressable
          style={[styles.kickBtn, kickLoading && styles.btnDisabled]}
          onPress={() => onKick?.(p.userId, p.username)}
          disabled={kickLoading}
        >
          <Text style={styles.kickBtnText}>Expulsar</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  screenWrap: { flex: 1 },
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingTop: 16, paddingBottom: 40 },
  refreshBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
  },
  refreshText: { fontSize: 12, color: "#1976d2" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },

  // Badges
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeLocked: { backgroundColor: "#d32f2f" },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  // Lock/Unlock
  lockBlock: { marginBottom: 12 },
  lockBtn: {
    borderRadius: 8,
    padding: 12,
    alignItems: "center" as const,
  },
  lockBtnLock: { backgroundColor: "#d32f2f" },
  lockBtnUnlock: { backgroundColor: "#2e7d32" },
  lockBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" as const },

  // Locked banner
  lockedBanner: {
    backgroundColor: "#fce4ec",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    alignItems: "center" as const,
  },
  lockedBannerText: {
    color: "#c62828",
    fontSize: 13,
    fontWeight: "600" as const,
  },

  // Cancel button
  cancelBlock: { marginTop: 20 },
  cancelBtn: {
    backgroundColor: "#b71c1c",
    borderRadius: 8,
    padding: 14,
    alignItems: "center" as const,
  },
  cancelBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },

  // Info block
  infoBlock: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 14, color: "#555" },
  infoValue: { fontSize: 14, fontWeight: "600" },

  // Counts
  countsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  countBadge: { alignItems: "center" },
  countNum: { fontSize: 22, fontWeight: "700" },
  countLabel: { fontSize: 11, color: "#888", marginTop: 2 },

  // Edit button
  editBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 8,
    padding: 12,
    alignItems: "center" as const,
    marginBottom: 12,
  },
  editBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" as const },

  // Spectator toggle button
  spectatorBlock: { marginTop: 8, marginBottom: 4 },
  spectatorBtn: {
    borderWidth: 1,
    borderColor: "#6d4c41",
    borderRadius: 8,
    padding: 12,
    alignItems: "center" as const,
  },
  spectatorBtnText: {
    color: "#6d4c41",
    fontSize: 14,
    fontWeight: "600" as const,
  },

  // Leave button
  leaveBlock: { marginTop: 16 },
  leaveBtn: {
    borderWidth: 1,
    borderColor: "#d32f2f",
    borderRadius: 8,
    padding: 14,
    alignItems: "center" as const,
  },
  leaveBtnText: { color: "#d32f2f", fontSize: 15, fontWeight: "600" as const },

  // Participant sections
  section: { marginBottom: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "600" },
  participantRow: {
    paddingVertical: 5,
    paddingHorizontal: 18,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  participantInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1,
    gap: 6,
  },
  participantId: { fontSize: 13, color: "#555" },
  roleBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  roleBadgeCreator: { backgroundColor: "#ff9800" },
  roleBadgeAdmin: { backgroundColor: "#7b1fa2" },
  roleBadgeText: { fontSize: 10, fontWeight: "700" as const, color: "#fff" },
  adminToggleBtn: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  adminTogglePromote: { backgroundColor: "#e8f5e9" },
  adminToggleDemote: { backgroundColor: "#fce4ec" },
  adminToggleText: { fontSize: 11, fontWeight: "600" as const, color: "#333" },
  kickBtn: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fce4ec",
    marginLeft: 4,
  },
  kickBtnText: { fontSize: 11, fontWeight: "600" as const, color: "#d32f2f" },

  // Status chip (in Others section)
  statusChip: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  statusChipText: { fontSize: 10, fontWeight: "700" as const, color: "#fff" },

  // Actions
  actions: { marginTop: 8, marginBottom: 4 },
  actionError: {
    color: "#d32f2f",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Invite
  inviteBlock: {
    marginTop: 20,
    backgroundColor: "#f0f4ff",
    borderRadius: 10,
    padding: 14,
  },
  inviteRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  inviteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  inviteBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  inviteBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  inviteMsg: { marginTop: 8, fontSize: 13, textAlign: "center" },
  inviteMsgSuccess: { color: "#2e7d32" },
  inviteMsgError: { color: "#d32f2f" },

  // Error states
  errorText: {
    fontSize: 15,
    color: "#d32f2f",
    marginBottom: 12,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  requestIdText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#999",
    marginBottom: 8,
  },

  // Group invite
  groupInviteBlock: {
    marginTop: 12,
    backgroundColor: "#f5f0ff",
    borderRadius: 10,
    padding: 14,
  },
  groupInviteBtn: {
    backgroundColor: "#7b1fa2",
    borderRadius: 8,
    padding: 12,
    alignItems: "center" as const,
  },
  groupInviteBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  groupInviteHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 10,
  },
  groupCancelText: {
    color: "#7b1fa2",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  groupEmptyText: {
    color: "#999",
    fontSize: 14,
    textAlign: "center" as const,
    marginTop: 8,
  },
  groupOption: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  groupOptionName: { fontSize: 15, fontWeight: "600" as const },
  groupOptionCount: { fontSize: 12, color: "#888", marginTop: 2 },
  memberCheckRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 8,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#7b1fa2",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  checkboxChecked: { backgroundColor: "#7b1fa2" },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" as const },
  memberCheckName: { fontSize: 14 },
  batchInviteBtn: {
    backgroundColor: "#7b1fa2",
    borderRadius: 8,
    padding: 12,
    alignItems: "center" as const,
    marginTop: 10,
  },
  batchInviteBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
  },

  // DEV badge
  devBadge: {
    backgroundColor: "#e8e8e8",
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },
  devBadgeText: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#444",
  },

  // Actividad section
  actividadBlock: {
    marginTop: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 12,
  },
  actividadHeader: {
    paddingVertical: 4,
  },
  actividadTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#333",
  },
  actividadEmpty: {
    fontSize: 13,
    color: "#999",
    marginTop: 8,
  },
  actividadEntry: {
    fontSize: 12,
    color: "#555",
    marginTop: 6,
    lineHeight: 18,
  },
  actividadMore: {
    marginTop: 10,
    alignItems: "center" as const,
  },
  actividadMoreText: {
    fontSize: 13,
    color: "#1976d2",
    fontWeight: "600" as const,
  },

});
