import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
import { Avatar } from "../components/Avatar";
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

// ── Design tokens ──
const DARK_BG = "#0d0d0d";
const CARD_BG = "#e0e0e0";
const PILL_TEXT_COLOR = "#1b5e20";
const PILL_BORDER_COLOR = "#2e7d32";
const ROW_LABEL_COLOR = "#1b5e20";
const VALUE_PILL_BG = "#f8f8f8";
const VALUE_PILL_BORDER = "#b8b8b8";
const CONFIRMED_DOT_COLOR = "#2e7d32";
const OTHER_DOT_COLOR = "#e65100";
const SPECTATOR_DOT_COLOR = "#6d4c41";

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

type CountdownResult = { display: string; mode: "DHM" | "HMS" } | null;

function formatMatchCountdown(isoString: string, now: number): CountdownResult {
  const diff = new Date(isoString).getTime() - now;
  if (diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  if (diff >= 24 * 3600 * 1000) {
    const days = Math.floor(totalSec / 86400);
    const hrs = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    return { display: `${days}:${p(hrs)}:${p(mins)}`, mode: "DHM" };
  }
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return { display: `${p(hrs)}:${p(mins)}:${p(secs)}`, mode: "HMS" };
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

  const { token, logout, user } = useAuth();
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

  const startsAtStr = displayMatch?.startsAt ?? null;
  useEffect(() => {
    if (!startsAtStr) { setCountdown(""); return; }

    let timerId: ReturnType<typeof setTimeout>;

    function tick() {
      const now = Date.now();
      const result = formatMatchCountdown(startsAtStr!, now);

      if (!result) { setCountdown(""); return; }
      setCountdown(result.display);
      setCountdownMode(result.mode);
      const interval = result.mode === "DHM" ? 60_000 : 1_000;
      const delay = result.mode === "DHM"
        ? interval - (now % interval)
        : 1_000;
      timerId = setTimeout(tick, delay);
    }

    tick();
    return () => clearTimeout(timerId);
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
  const [countdownMode, setCountdownMode] = useState<"DHM" | "HMS">("HMS");
  const [spectatorLoading, setSpectatorLoading] = useState(false);
  const [spectatorError, setSpectatorError] = useState("");
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [showInviteBlock, setShowInviteBlock] = useState(false);
  const [participantView, setParticipantView] = useState<"teams" | "list">("teams");
  const [inviteMode, setInviteMode] = useState<"player" | "group">("player");

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
        <ActivityIndicator size="large" color="#fff" />
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
  // Read-only when the match is immutable (server-side status: IN_PROGRESS, PLAYED, or CANCELLED).
  const isReadOnly =
    displayMatch.matchStatus === "IN_PROGRESS" ||
    displayMatch.matchStatus === "PLAYED" ||
    displayMatch.matchStatus === "CANCELLED";
  const canKick = !isReadOnly && displayMatch.actionsAllowed.includes("manage_kick");
  const canManageTeams = displayMatch.actionsAllowed.includes("manage_teams");
  const CHAT_STATUSES = ["CONFIRMED", "WAITLISTED", "SPECTATOR"];
  const canChat =
    user?.id === displayMatch.createdById ||
    (displayMatch.myStatus != null &&
      CHAT_STATUSES.includes(displayMatch.myStatus));
  const groups = deriveParticipantGroups(displayMatch);

  return (
    <View style={styles.screenWrap}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>

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

      {/* Title + status badges */}
      <Text style={styles.matchTitle}>{displayMatch.title}</Text>
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

      {/* 1. Status panel: countdown / in_progress / played */}
      {displayMatch.matchStatus === "IN_PROGRESS" ? (
        <MatchInProgressPanel />
      ) : displayMatch.matchStatus === "PLAYED" ? (
        <MatchPlayedPanel />
      ) : countdown ? (
        <MatchCountdownPanel countdown={countdown} mode={countdownMode} />
      ) : null}

      {/* 2. Match info */}
      <MatchInfoCard
        match={displayMatch}
        canEdit={canEdit}
        onEdit={() => navigation.navigate("EditMatch", { matchId })}
      />

      {/* 3a. Teams display (when configured) or confirmed list */}
      {displayMatch.teamsConfigured && displayMatch.teams ? (
        <>
          <View style={styles.viewToggleRow}>
            <Pressable
              style={[styles.viewToggleBtn, participantView === "teams" && styles.viewToggleBtnActive]}
              onPress={() => setParticipantView("teams")}
            >
              <Text style={[styles.viewToggleBtnText, participantView === "teams" && styles.viewToggleBtnTextActive]}>
                Equipos
              </Text>
            </Pressable>
            <Pressable
              style={[styles.viewToggleBtn, participantView === "list" && styles.viewToggleBtnActive]}
              onPress={() => setParticipantView("list")}
            >
              <Text style={[styles.viewToggleBtnText, participantView === "list" && styles.viewToggleBtnTextActive]}>
                Lista
              </Text>
            </Pressable>
          </View>
          {participantView === "teams" ? (
            <TeamsDisplayCard
              teams={displayMatch.teams}
              capacity={displayMatch.capacity}
              canManageTeams={canManageTeams}
              onManageTeams={() => navigation.navigate("TeamAssembly", { matchId })}
              others={[...groups.waitlist, ...groups.invited]}
              spectators={groups.spectators}
              creatorId={displayMatch.createdById}
              canManageAdmins={canManageAdmins}
              canKick={canKick}
              adminActionLoading={adminActionLoading}
              kickLoading={kickLoading}
              onPromote={handlePromote}
              onDemote={handleDemote}
              onKick={handleKick}
              onUserPress={(userId) => navigation.navigate("PublicUserProfile", { userId })}
            />
          ) : (
            <ConfirmedListCard
              confirmed={groups.confirmed}
              capacity={displayMatch.capacity}
              others={[...groups.waitlist, ...groups.invited]}
              spectators={groups.spectators}
              creatorId={displayMatch.createdById}
              canManageAdmins={canManageAdmins}
              canKick={canKick}
              adminActionLoading={adminActionLoading}
              kickLoading={kickLoading}
              onPromote={handlePromote}
              onDemote={handleDemote}
              onKick={handleKick}
              onUserPress={(userId) => navigation.navigate("PublicUserProfile", { userId })}
            />
          )}
        </>
      ) : (
        <ConfirmedListCard
          confirmed={groups.confirmed}
          capacity={displayMatch.capacity}
          others={[...groups.waitlist, ...groups.invited]}
          spectators={groups.spectators}
          creatorId={displayMatch.createdById}
          canManageAdmins={canManageAdmins}
          canKick={canKick}
          adminActionLoading={adminActionLoading}
          kickLoading={kickLoading}
          onPromote={handlePromote}
          onDemote={handleDemote}
          onKick={handleKick}
          onUserPress={(userId) => navigation.navigate("PublicUserProfile", { userId })}
        />
      )}

      {/* 3b. "Armar equipos" button (only when teams not yet configured) */}
      {canManageTeams && !displayMatch.teamsConfigured && (
        <Pressable
          style={styles.teamsBtn}
          onPress={() => navigation.navigate("TeamAssembly", { matchId })}
        >
          <Text style={styles.teamsBtnText}>Armar equipos</Text>
        </Pressable>
      )}

      {/* 3c. Chat button */}
      {canChat && (
        <Pressable
          style={styles.chatBtn}
          onPress={() => navigation.navigate("MatchChat", { matchId })}
        >
          <Text style={styles.chatBtnText}>Chat del partido</Text>
        </Pressable>
      )}

      {/* 4. Actions bar */}
      {!isReadOnly && (
        <MatchActionsBar
          visibleActions={visibleActions as string[]}
          canSpectator={canSpectator}
          isSpectator={isSpectator}
          canInvite={canInvite}
          canToggleLock={canToggleLock}
          isLocked={displayMatch.isLocked}
          mutation={mutation}
          lockTogglePending={lockTogglePending}
          spectatorLoading={spectatorLoading}
          rejectLoading={rejectLoading}
          onAction={handleAction}
          onSpectator={handleSpectatorToggle}
          onInvite={() => setShowInviteBlock((b) => !b)}
          onLockToggle={handleLockToggle}
        />
      )}

      {/* Error messages */}
      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
      {lockError ? <Text style={styles.errorText}>{lockError}</Text> : null}
      {spectatorError ? <Text style={styles.errorText}>{spectatorError}</Text> : null}

      {/* 5. Invite block (unified: jugador directo + desde grupo) */}
      {showInviteBlock && canInvite && !isReadOnly && (
        <View style={styles.inviteBlock}>
          {/* Mode selector */}
          <View style={styles.inviteModeRow}>
            <Pressable
              style={[styles.inviteModeBtn, inviteMode === "player" && styles.inviteModeBtnActive]}
              onPress={() => setInviteMode("player")}
            >
              <Text style={[styles.inviteModeBtnText, inviteMode === "player" && styles.inviteModeBtnTextActive]}>
                Jugador
              </Text>
            </Pressable>
            {!displayMatch.isLocked && (
              <Pressable
                style={[styles.inviteModeBtn, inviteMode === "group" && styles.inviteModeBtnActive]}
                onPress={() => {
                  setInviteMode("group");
                  setShowGroupInvite(true);
                }}
              >
                <Text style={[styles.inviteModeBtnText, inviteMode === "group" && styles.inviteModeBtnTextActive]}>
                  Desde grupo
                </Text>
              </Pressable>
            )}
          </View>

          {inviteMode === "player" ? (
            <>
              <View style={styles.inviteRow}>
                <TextInput
                  style={styles.inviteInput}
                  placeholder="@usuario o email"
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
                    (!inviteInput.trim() || inviteMutation.isPending) && styles.btnDisabled,
                  ]}
                  onPress={handleInvite}
                  disabled={!inviteInput.trim() || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.inviteBtnText}>Invitar</Text>
                  )}
                </Pressable>
              </View>
              {inviteMsg ? (
                <Text
                  style={[
                    styles.inviteMsg,
                    inviteMsgType === "error" ? styles.inviteMsgError : styles.inviteMsgSuccess,
                  ]}
                >
                  {inviteMsg}
                </Text>
              ) : null}
            </>
          ) : !selectedGroupId ? (
            <View>
              <View style={styles.groupInviteHeader}>
                <Text style={styles.sectionTitle}>Seleccionar grupo</Text>
                <Pressable onPress={() => { setShowGroupInvite(false); setInviteMode("player"); }}>
                  <Text style={styles.groupCancelText}>Cancelar</Text>
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
                  <Text style={styles.groupEmptyText}>Sin grupos</Text>
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
                      <Text style={styles.groupOptionCount}>{g.memberCount} miembros</Text>
                    </Pressable>
                  ))
                );
              })()}
            </View>
          ) : (
            <View>
              <View style={styles.groupInviteHeader}>
                <Text style={styles.sectionTitle}>Seleccionar miembros</Text>
                <Pressable
                  onPress={() => {
                    setSelectedGroupId("");
                    setSelectedMembers(new Set());
                  }}
                >
                  <Text style={styles.groupCancelText}>Volver</Text>
                </Pressable>
              </View>
              {candidatesQuery.isLoading ? (
                <ActivityIndicator size="small" style={{ marginTop: 12 }} />
              ) : (
                <>
                  {(candidatesQuery.data?.candidates ?? []).map(
                    (c: InviteCandidate) => {
                      const isSelected = selectedMembers.has(c.username);
                      const isDisabled = !c.canInvite || batchInviteMutation.isPending;
                      return (
                        <Pressable
                          key={c.userId}
                          style={[styles.memberCheckRow, isDisabled && { opacity: 0.5 }]}
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
                          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={styles.memberCheckName}>@{c.username}</Text>
                          {c.matchStatus !== "NONE" && (
                            <View
                              style={[
                                styles.statusChip,
                                { backgroundColor: CANDIDATE_STATUS_COLOR[c.matchStatus] ?? "#999" },
                              ]}
                            >
                              <Text style={styles.statusChipText}>
                                {CANDIDATE_STATUS_LABEL[c.matchStatus] ?? c.matchStatus}
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
                      (selectedMembers.size === 0 || batchInviteMutation.isPending) && styles.btnDisabled,
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
                                ? `Invitados: ${result.successful}`
                                : `Invitados ${result.successful}/${result.total}. Fallidos: ${result.errors.map((e) => `@${e.username}`).join(", ")}`;
                            Alert.alert("Resultado", msg);
                            setShowGroupInvite(false);
                            setSelectedGroupId("");
                            setSelectedMembers(new Set());
                            setInviteMode("player");
                          },
                        },
                      );
                    }}
                    disabled={selectedMembers.size === 0 || batchInviteMutation.isPending}
                  >
                    {batchInviteMutation.isPending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.batchInviteBtnText}>
                        Invitar ({selectedMembers.size})
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {/* 7. Actividad section */}
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

      {/* 8. Destructive actions (bottom, separate from operational actions) */}
      {!isReadOnly && (canLeave || canCancel) && (
        <View style={styles.destructiveActionsBlock}>
          {leaveError ? <Text style={[styles.errorText, { marginBottom: 8 }]}>{leaveError}</Text> : null}
          {cancelError ? <Text style={[styles.errorText, { marginBottom: 8 }]}>{cancelError}</Text> : null}
          {canLeave && (
            <Pressable
              style={[styles.destructiveTextBtn, leaveLoading && styles.btnDisabled]}
              onPress={handleLeave}
              disabled={leaveLoading}
            >
              {leaveLoading ? (
                <ActivityIndicator color="#d32f2f" size="small" />
              ) : (
                <Text style={styles.destructiveTextBtnLabel}>Abandonar partido</Text>
              )}
            </Pressable>
          )}
          {canCancel && (
            <Pressable
              style={[styles.destructiveTextBtn, cancelMutation.isPending && styles.btnDisabled]}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator color="#d32f2f" size="small" />
              ) : (
                <Text style={styles.destructiveTextBtnLabel}>Cancelar partido</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

    </ScrollView>
    </View>
  );
}

// ── Subcomponents ──

function SectionPill({ label, badge }: { label: string; badge?: string }) {
  return (
    <View style={{ alignItems: "center", marginBottom: 12 }}>
      <View style={styles.sectionPill}>
        <Text style={styles.sectionPillText}>{label}</Text>
        {badge !== undefined ? (
          <Text style={styles.sectionPillBadge}> {badge}</Text>
        ) : null}
      </View>
    </View>
  );
}

function MatchInProgressPanel() {
  return (
    <View style={[styles.countdownCard, styles.inProgressCard]}>
      <Text style={styles.inProgressLabel}>PARTIDO EN JUEGO</Text>
    </View>
  );
}

function MatchPlayedPanel() {
  return (
    <View style={[styles.countdownCard, styles.playedCard]}>
      <Text style={styles.playedLabel}>PARTIDO FINALIZADO</Text>
    </View>
  );
}

function MatchCountdownPanel({ countdown, mode }: { countdown: string; mode: "DHM" | "HMS" }) {
  const unitLabel = mode === "DHM" ? "DÍAS  :  HS  :  MIN" : "HS  :  MIN  :  SEG";
  return (
    <View style={styles.countdownCard}>
      <Text style={styles.countdownLabel}>PARTIDO COMIENZA EN:</Text>
      <View style={styles.countdownPill}>
        <Text style={styles.countdownValue}>{countdown}</Text>
      </View>
      <Text style={styles.countdownUnits}>{unitLabel}</Text>
    </View>
  );
}

function buildVenueMapsUrl(v: {
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
}): string | null {
  if (v.mapsUrl) return v.mapsUrl;
  if (v.latitude != null && v.longitude != null) {
    return `https://maps.google.com/?q=${v.latitude},${v.longitude}`;
  }
  return null;
}

function formatPrice(price: number | null, capacity: number): string {
  if (price == null) return "Precio no informado";
  const total = `$${price.toLocaleString("es-AR")}`;
  const perPlayer = capacity > 0 ? ` ($${Math.round(price / capacity).toLocaleString("es-AR")} c/u)` : "";
  return `${total}${perPlayer}`;
}

function MatchInfoCard({
  match,
  canEdit,
  onEdit,
}: {
  match: MatchSnapshot;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const venue = match.venueSnapshot ?? null;
  const pitch = match.pitchSnapshot ?? null;
  const mapsUrl = venue ? buildVenueMapsUrl(venue) : null;

  return (
    <View style={styles.card}>
      <View style={styles.infoCardHeader}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <SectionPill label="INFORMACIÓN" />
        </View>
        {canEdit && onEdit && (
          <Pressable onPress={onEdit} style={styles.infoEditBtn} hitSlop={8}>
            <Text style={styles.infoEditBtnText}>Editar</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>DÍA - HORA</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={styles.infoValuePill}>
            <Text style={styles.infoValueText}>{formatDate(match.startsAt)}</Text>
          </View>
          <View style={styles.infoValuePill}>
            <Text style={styles.infoValueText}>{formatTime(match.startsAt)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>TIPO DE PARTIDO</Text>
        <View style={styles.infoValuePill}>
          <Text style={styles.infoValueText}>
            {MATCH_GENDER_LABEL[match.matchGender] ?? "—"}
          </Text>
        </View>
      </View>

      {venue && pitch ? (
        <>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PREDIO</Text>
            <View style={styles.infoValuePill}>
              <Text style={styles.infoValueText}>{venue.name}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CANCHA</Text>
            <View style={styles.infoValuePill}>
              <Text style={styles.infoValueText}>{pitch.name} · {pitch.pitchType}</Text>
            </View>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: mapsUrl ? 1 : 0 }]}>
            <Text style={styles.infoLabel}>PRECIO</Text>
            <View style={styles.infoValuePill}>
              <Text style={styles.infoValueText}>{formatPrice(pitch.price, match.capacity)}</Text>
            </View>
          </View>
          {mapsUrl ? (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>MAPA</Text>
              <Pressable onPress={() => void Linking.openURL(mapsUrl)} hitSlop={8}>
                <Text style={styles.mapLinkText}>Abrir en mapa</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : (
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>PRECIO</Text>
          <View style={styles.infoValuePill}>
            <Text style={styles.infoValueText}>—</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function PlayerRow({
  participant: p,
  isConfirmed,
  creatorId,
  canManageAdmins,
  canKick,
  adminActionLoading,
  kickLoading,
  onPromote,
  onDemote,
  onKick,
  onUserPress,
}: {
  participant: ParticipantView;
  isConfirmed: boolean;
  creatorId: string;
  canManageAdmins: boolean;
  canKick: boolean;
  adminActionLoading: boolean;
  kickLoading: boolean;
  onPromote: (userId: string, username: string) => void;
  onDemote: (userId: string, username: string) => void;
  onKick: (userId: string, username: string) => void;
  onUserPress?: (userId: string) => void;
}) {
  const isCreator = p.userId === creatorId;
  const dotColor = isConfirmed ? CONFIRMED_DOT_COLOR : OTHER_DOT_COLOR;
  return (
    <View style={styles.playerRow}>
      <Pressable style={styles.playerIdentity} onPress={() => onUserPress?.(p.userId)}>
        <Avatar uri={p.avatarUrl} size={28} fallbackText={p.username} />
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={styles.playerName} numberOfLines={1}>
          {isCreator ? "★ " : ""}{p.username}
          {!isCreator && p.isMatchAdmin ? " [A]" : ""}
          {p.waitlistPosition != null ? ` #${p.waitlistPosition}` : ""}
        </Text>
      </Pressable>
      <View style={styles.playerActions}>
        {canManageAdmins && !isCreator && (
          <Pressable
            style={[
              styles.adminBtn,
              p.isMatchAdmin ? styles.adminBtnDemote : styles.adminBtnPromote,
              adminActionLoading && styles.btnDisabled,
            ]}
            onPress={() =>
              p.isMatchAdmin
                ? onDemote(p.userId, p.username)
                : onPromote(p.userId, p.username)
            }
            disabled={adminActionLoading}
          >
            <Text style={styles.adminBtnText}>
              {p.isMatchAdmin ? "Admin ✕" : "+Admin"}
            </Text>
          </Pressable>
        )}
        {canKick && !isCreator && (
          <Pressable
            style={[styles.kickChipBtn, kickLoading && styles.btnDisabled]}
            onPress={() => onKick(p.userId, p.username)}
            disabled={kickLoading}
          >
            <Text style={styles.kickChipBtnText}>Expulsar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function OthersAccordion({
  others,
  spectators,
  creatorId,
  canManageAdmins,
  canKick,
  adminActionLoading,
  kickLoading,
  onPromote,
  onDemote,
  onKick,
  onUserPress,
}: {
  others: ParticipantView[];
  spectators: SpectatorView[];
  creatorId: string;
  canManageAdmins: boolean;
  canKick: boolean;
  adminActionLoading: boolean;
  kickLoading: boolean;
  onPromote: (userId: string, username: string) => void;
  onDemote: (userId: string, username: string) => void;
  onKick: (userId: string, username: string) => void;
  onUserPress?: (userId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = others.length + spectators.length;
  return (
    <View>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.othersToggle}>
        <Text style={styles.othersToggleText}>
          {expanded ? "▲ Ocultar otros" : `▼ Ver otros (${total})`}
        </Text>
      </Pressable>
      {expanded && (
        <>
          {others.map((p) => (
            <PlayerRow
              key={p.userId}
              participant={p}
              isConfirmed={false}
              creatorId={creatorId}
              canManageAdmins={canManageAdmins}
              canKick={canKick}
              adminActionLoading={adminActionLoading}
              kickLoading={kickLoading}
              onPromote={onPromote}
              onDemote={onDemote}
              onKick={onKick}
              onUserPress={onUserPress}
            />
          ))}
          {spectators.map((s) => (
            <View key={s.userId} style={styles.playerRow}>
              <Pressable style={styles.playerIdentity} onPress={() => onUserPress?.(s.userId)}>
                <Avatar uri={s.avatarUrl} size={28} fallbackText={s.username} />
                <View style={[styles.statusDot, { backgroundColor: SPECTATOR_DOT_COLOR }]} />
                <Text style={styles.playerName}>-{s.username}</Text>
              </Pressable>
              {canKick && s.userId !== creatorId && (
                <View style={styles.playerActions}>
                  <Pressable
                    style={[styles.kickChipBtn, kickLoading && styles.btnDisabled]}
                    onPress={() => onKick(s.userId, s.username)}
                    disabled={kickLoading}
                  >
                    <Text style={styles.kickChipBtnText}>Expulsar</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}


function ConfirmedListCard({
  confirmed,
  capacity,
  others,
  spectators,
  creatorId,
  canManageAdmins,
  canKick,
  adminActionLoading,
  kickLoading,
  onPromote,
  onDemote,
  onKick,
  onUserPress,
}: {
  confirmed: ParticipantView[];
  capacity: number;
  others: ParticipantView[];
  spectators: SpectatorView[];
  creatorId: string;
  canManageAdmins: boolean;
  canKick: boolean;
  adminActionLoading: boolean;
  kickLoading: boolean;
  onPromote: (userId: string, username: string) => void;
  onDemote: (userId: string, username: string) => void;
  onKick: (userId: string, username: string) => void;
  onUserPress?: (userId: string) => void;
}) {
  return (
    <View style={styles.card}>
      <SectionPill label="CONFIRMADOS" badge={`${confirmed.length}/${capacity}`} />
      <Text style={styles.confirmedSubtitle}>JUGADORES CONFIRMADOS</Text>
      {confirmed.map((p) => (
        <PlayerRow
          key={p.userId}
          participant={p}
          isConfirmed={true}
          creatorId={creatorId}
          canManageAdmins={canManageAdmins}
          canKick={canKick}
          adminActionLoading={adminActionLoading}
          kickLoading={kickLoading}
          onPromote={onPromote}
          onDemote={onDemote}
          onKick={onKick}
          onUserPress={onUserPress}
        />
      ))}
      {confirmed.length === 0 && (
        <Text style={styles.emptyListText}>Sin confirmados aún</Text>
      )}
      {(others.length > 0 || spectators.length > 0) && (
        <OthersAccordion
          others={others}
          spectators={spectators}
          creatorId={creatorId}
          canManageAdmins={canManageAdmins}
          canKick={canKick}
          adminActionLoading={adminActionLoading}
          kickLoading={kickLoading}
          onPromote={onPromote}
          onDemote={onDemote}
          onKick={onKick}
          onUserPress={onUserPress}
        />
      )}
    </View>
  );
}

// ── TeamsDisplayCard ──

function TeamsDisplayCard({
  teams,
  capacity,
  canManageTeams,
  onManageTeams,
  others,
  spectators,
  creatorId,
  canManageAdmins,
  canKick,
  adminActionLoading,
  kickLoading,
  onPromote,
  onDemote,
  onKick,
  onUserPress,
}: {
  teams: { teamA: import("../types/api").TeamSlotView[]; teamB: import("../types/api").TeamSlotView[] };
  capacity: number;
  canManageTeams?: boolean;
  onManageTeams?: () => void;
  others: ParticipantView[];
  spectators: SpectatorView[];
  creatorId: string;
  canManageAdmins: boolean;
  canKick: boolean;
  adminActionLoading: boolean;
  kickLoading: boolean;
  onPromote: (userId: string, username: string) => void;
  onDemote: (userId: string, username: string) => void;
  onKick: (userId: string, username: string) => void;
  onUserPress?: (userId: string) => void;
}) {
  const slotsPerTeam = Math.floor(capacity / 2);
  const teamACount = teams.teamA.filter((s) => s.userId !== null).length;
  const teamBCount = teams.teamB.filter((s) => s.userId !== null).length;

  return (
    <View style={styles.card}>
      <View style={styles.infoCardHeader}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <SectionPill label="EQUIPOS" badge={`${teamACount + teamBCount}/${capacity}`} />
        </View>
        {canManageTeams && onManageTeams && (
          <Pressable onPress={onManageTeams} style={styles.infoEditBtn} hitSlop={8}>
            <Text style={styles.infoEditBtnText}>Editar</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.teamsDisplayRow}>
        {/* Equipo A */}
        <View style={styles.teamsDisplayCol}>
          <Text style={styles.teamsDisplayHeader}>
            Equipo A{" "}
            <Text style={styles.teamsDisplayCounter}>
              {teamACount}/{slotsPerTeam}
            </Text>
          </Text>
          {teams.teamA.map((slot) => (
            <View key={slot.slotIndex} style={styles.teamsDisplaySlot}>
              <View
                style={[
                  styles.teamsDisplayDot,
                  { backgroundColor: slot.userId ? "#1565c0" : "#ddd" },
                ]}
              />
              <Text
                style={[
                  styles.teamsDisplaySlotText,
                  !slot.userId && styles.teamsDisplaySlotEmpty,
                ]}
                numberOfLines={1}
              >
                {slot.username ?? "—"}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.teamsDisplayDivider} />

        {/* Equipo B */}
        <View style={styles.teamsDisplayCol}>
          <Text style={styles.teamsDisplayHeader}>
            Equipo B{" "}
            <Text style={styles.teamsDisplayCounter}>
              {teamBCount}/{slotsPerTeam}
            </Text>
          </Text>
          {teams.teamB.map((slot) => (
            <View key={slot.slotIndex} style={styles.teamsDisplaySlot}>
              <View
                style={[
                  styles.teamsDisplayDot,
                  { backgroundColor: slot.userId ? "#b71c1c" : "#ddd" },
                ]}
              />
              <Text
                style={[
                  styles.teamsDisplaySlotText,
                  !slot.userId && styles.teamsDisplaySlotEmpty,
                ]}
                numberOfLines={1}
              >
                {slot.username ?? "—"}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {(others.length > 0 || spectators.length > 0) && (
        <OthersAccordion
          others={others}
          spectators={spectators}
          creatorId={creatorId}
          canManageAdmins={canManageAdmins}
          canKick={canKick}
          adminActionLoading={adminActionLoading}
          kickLoading={kickLoading}
          onPromote={onPromote}
          onDemote={onDemote}
          onKick={onKick}
          onUserPress={onUserPress}
        />
      )}
    </View>
  );
}

function MatchActionsBar({
  visibleActions,
  canSpectator,
  isSpectator,
  canInvite,
  canToggleLock,
  isLocked,
  mutation,
  lockTogglePending,
  spectatorLoading,
  rejectLoading,
  onAction,
  onSpectator,
  onInvite,
  onLockToggle,
}: {
  visibleActions: string[];
  canSpectator: boolean;
  isSpectator: boolean;
  canInvite: boolean;
  canToggleLock: boolean;
  isLocked: boolean;
  mutation: { isPending: boolean };
  lockTogglePending: boolean;
  spectatorLoading: boolean;
  rejectLoading: boolean;
  onAction: (action: string) => void;
  onSpectator: () => void;
  onInvite: () => void;
  onLockToggle: () => void;
}) {
  const anyLoading = mutation.isPending || rejectLoading;
  const hasActions =
    visibleActions.includes("confirm") ||
    visibleActions.includes("reject") ||
    canSpectator ||
    canInvite ||
    canToggleLock;
  if (!hasActions) return null;
  return (
    <View style={styles.actionsBar}>
      <View style={styles.actionsGrid}>
        {visibleActions.includes("confirm") && (
          <Pressable
            style={[
              styles.actionChip,
              { backgroundColor: "#2e7d32" },
              anyLoading && styles.btnDisabled,
            ]}
            onPress={() => onAction("confirm")}
            disabled={anyLoading}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionChipText}>CONFIRMAR</Text>
            )}
          </Pressable>
        )}
        {visibleActions.includes("reject") && (
          <Pressable
            style={[
              styles.actionChip,
              { backgroundColor: "#757575" },
              anyLoading && styles.btnDisabled,
            ]}
            onPress={() => onAction("reject")}
            disabled={anyLoading}
          >
            {rejectLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionChipText}>RECHAZAR</Text>
            )}
          </Pressable>
        )}
        {canSpectator && (
          <Pressable
            style={[
              styles.actionChip,
              { backgroundColor: "#5d4037" },
              spectatorLoading && styles.btnDisabled,
            ]}
            onPress={onSpectator}
            disabled={spectatorLoading}
          >
            {spectatorLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionChipText}>
                {isSpectator ? "PARTICIPAR" : "ESPECTADOR"}
              </Text>
            )}
          </Pressable>
        )}
        {canInvite && (
          <Pressable
            style={[styles.actionChip, { backgroundColor: "#1565c0" }]}
            onPress={onInvite}
          >
            <Text style={styles.actionChipText}>INVITAR</Text>
          </Pressable>
        )}
        {canToggleLock && (
          <Pressable
            style={[
              styles.actionChip,
              { backgroundColor: isLocked ? "#388e3c" : "#c62828" },
              lockTogglePending && styles.btnDisabled,
            ]}
            onPress={onLockToggle}
            disabled={lockTogglePending}
          >
            {lockTogglePending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionChipText}>
                {isLocked ? "DESBLOQUEAR" : "BLOQUEAR"}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  screenWrap: { flex: 1, backgroundColor: DARK_BG },
  scrollContent: { padding: 16, paddingBottom: 48 },
  refreshBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: "#1a2a3a",
    borderRadius: 8,
  },
  refreshText: { fontSize: 12, color: "#90caf9" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: DARK_BG,
  },
  matchTitle: { fontSize: 22, fontWeight: "700", color: "#ffffff", marginBottom: 8 },

  // Badges
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "#444",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeLocked: { backgroundColor: "#d32f2f" },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  // Card common
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },

  // Section pill
  sectionPill: {
    borderWidth: 2,
    borderColor: PILL_BORDER_COLOR,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionPillText: {
    color: PILL_TEXT_COLOR,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionPillBadge: {
    color: PILL_TEXT_COLOR,
    fontWeight: "700",
    fontSize: 15,
  },

  // Countdown
  countdownCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  countdownLabel: {
    color: PILL_TEXT_COLOR,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 10,
  },
  countdownPill: {
    borderWidth: 1.5,
    borderColor: "#aaa",
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: VALUE_PILL_BG,
  },
  countdownValue: { fontSize: 36, fontWeight: "700", color: "#111", letterSpacing: 2 },
  countdownUnits: {
    fontSize: 11,
    color: PILL_TEXT_COLOR,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 6,
  },
  inProgressCard: {
    backgroundColor: "#e8f5e9",
  },
  inProgressLabel: {
    color: "#1b5e20",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 1.5,
  },
  playedCard: {
    backgroundColor: "#f5f5f5",
  },
  playedLabel: {
    color: "#616161",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 1,
  },

  // Info rows
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#c8c8c8",
  },
  infoLabel: {
    flex: 1,
    color: ROW_LABEL_COLOR,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  infoValuePill: {
    borderWidth: 1,
    borderColor: VALUE_PILL_BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: VALUE_PILL_BG,
  },
  infoValueText: { color: "#1a1a1a", fontWeight: "600", fontSize: 13 },

  // Confirmed list
  confirmedSubtitle: {
    color: ROW_LABEL_COLOR,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptyListText: { color: "#666", fontSize: 13, textAlign: "center", paddingVertical: 8 },

  // Chat button
  chatBtn: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "#1976d2",
  },
  chatBtnText: {
    color: "#1976d2",
    fontSize: 15,
    fontWeight: "600",
  },

  // Teams button
  teamsBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 12,
    borderCurve: "continuous",
  },
  teamsBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // Teams display card
  teamsDisplayRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  teamsDisplayCol: {
    flex: 1,
    paddingHorizontal: 4,
  },
  teamsDisplayDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#ddd",
    marginHorizontal: 4,
  },
  teamsDisplayHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  teamsDisplayCounter: {
    fontWeight: "400",
    color: "#999",
  },
  teamsDisplaySlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
  },
  teamsDisplayDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  teamsDisplaySlotText: {
    fontSize: 13,
    color: "#222",
    flex: 1,
  },
  teamsDisplaySlotEmpty: {
    color: "#bbb",
    fontStyle: "italic",
  },

  // Player rows
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#c8c8c8",
  },
  playerIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  playerName: { flex: 1, fontWeight: "600", color: "#1a1a1a", fontSize: 14 },
  playerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  adminBtn: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  adminBtnPromote: { backgroundColor: "#e8f5e9" },
  adminBtnDemote: { backgroundColor: "#fce4ec" },
  adminBtnText: { fontSize: 11, fontWeight: "600", color: "#333" },
  kickChipBtn: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fce4ec",
  },
  kickChipBtnText: { fontSize: 11, fontWeight: "600", color: "#d32f2f" },
  othersToggle: { paddingVertical: 10, alignItems: "center" },
  othersToggleText: { color: "#1976d2", fontWeight: "600", fontSize: 13 },

  // Actions bar
  actionsBar: { marginBottom: 16 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: "center",
  },
  actionChipText: { fontWeight: "700", fontSize: 13, color: "#fff" },

  // Common
  btnDisabled: { opacity: 0.5 },

  // Invite
  inviteBlock: {
    marginTop: 4,
    backgroundColor: "#1a2a1a",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#ccc" },
  inviteRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  inviteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#555",
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
  inviteMsgSuccess: { color: "#81c784" },
  inviteMsgError: { color: "#ef9a9a" },

  // Error states
  errorText: {
    fontSize: 13,
    color: "#ef9a9a",
    marginBottom: 8,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  mapLinkText: { fontSize: 13, color: "#1976d2", fontWeight: "500" },
  requestIdText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#888",
    marginBottom: 8,
  },

  // Group invite
  groupInviteBlock: {
    marginTop: 4,
    backgroundColor: "#1e1528",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
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
    color: "#ce93d8",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  groupEmptyText: {
    color: "#888",
    fontSize: 14,
    textAlign: "center" as const,
    marginTop: 8,
  },
  groupOption: {
    backgroundColor: "#2a1f35",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  groupOptionName: { fontSize: 15, fontWeight: "600" as const, color: "#fff" },
  groupOptionCount: { fontSize: 12, color: "#aaa", marginTop: 2 },
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
  memberCheckName: { fontSize: 14, color: "#eee" },
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

  // Status chip (kept for group invite candidates)
  statusChip: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  statusChipText: { fontSize: 10, fontWeight: "700" as const, color: "#fff" },

  // DEV badge
  devBadge: {
    backgroundColor: "#1a1a1a",
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },
  devBadgeText: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#aaa",
  },

  // Actividad section
  actividadBlock: {
    marginTop: 8,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  actividadHeader: {
    paddingVertical: 4,
  },
  actividadTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#aaa",
  },
  actividadEmpty: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
  },
  actividadEntry: {
    fontSize: 12,
    color: "#888",
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

  // View toggle (Equipos / Lista)
  viewToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  viewToggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#555",
    backgroundColor: "transparent",
  },
  viewToggleBtnActive: {
    borderColor: "#1976d2",
    backgroundColor: "#1976d2",
  },
  viewToggleBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#aaa",
  },
  viewToggleBtnTextActive: {
    color: "#fff",
  },

  // Info card header with edit button
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoEditBtn: {
    position: "absolute",
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0277bd",
  },
  infoEditBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0277bd",
  },

  // Unified invite mode selector
  inviteModeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  inviteModeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#555",
  },
  inviteModeBtnActive: {
    borderColor: "#1976d2",
    backgroundColor: "#1976d2",
  },
  inviteModeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#aaa",
  },
  inviteModeBtnTextActive: {
    color: "#fff",
  },

  // Destructive actions block (bottom)
  destructiveActionsBlock: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#333",
    gap: 4,
  },
  destructiveTextBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  destructiveTextBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#d32f2f",
  },
});
