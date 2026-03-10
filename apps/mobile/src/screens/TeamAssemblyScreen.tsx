import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useMatch } from "../features/matches/useMatch";
import { saveTeams, blockTeamAutoGen } from "../features/matches/matchesClient";
import { ApiError } from "../lib/api";
import type { MatchSnapshot, ParticipantView } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "TeamAssembly">;

// ── Types ──

type Slot = string | null;

interface SlotId {
  team: "A" | "B";
  index: number;
}

// ── Helpers ──

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Snake draft: PRO → A, #2 → B, #3 → B, #4 → A, ... */
function snakeDraft(players: string[], slotsPerTeam: number): [Slot[], Slot[]] {
  const teamA: Slot[] = Array<Slot>(slotsPerTeam).fill(null);
  const teamB: Slot[] = Array<Slot>(slotsPerTeam).fill(null);
  let ai = 0;
  let bi = 0;
  players.forEach((id, i) => {
    const pos = i % 4;
    if ((pos === 0 || pos === 3) && ai < slotsPerTeam) {
      teamA[ai++] = id;
    } else if (bi < slotsPerTeam) {
      teamB[bi++] = id;
    } else if (ai < slotsPerTeam) {
      teamA[ai++] = id;
    }
  });
  return [teamA, teamB];
}

function formatTeamError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "REVISION_CONFLICT":
        return "El partido fue actualizado. Por favor volvé a intentarlo.";
      case "INVALID_TEAM_SIZE":
        return "El tamaño de los equipos no coincide con la capacidad del partido.";
      case "DUPLICATE_PLAYER_IN_TEAMS":
        return "Un jugador no puede estar en los dos equipos a la vez.";
      case "PLAYER_NOT_CONFIRMED":
        return "Algunos jugadores no están confirmados en el partido.";
      case "MATCH_CANCELLED":
        return "El partido ya no está disponible para modificaciones.";
      case "FORBIDDEN":
        return "Solo el organizador puede modificar los equipos.";
      default:
        return err.body.message ?? "Error al guardar los equipos.";
    }
  }
  return "Error de conexión. Intentá de nuevo.";
}

// ── Main Screen ──

export default function TeamAssemblyScreen({ navigation, route }: Props) {
  const { matchId } = route.params;
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // useMatch already selects data.match — returns MatchSnapshot | undefined
  const { data: match, isLoading } = useMatch(matchId);

  // Signal to the backend that the creator has opened this screen,
  // blocking the scheduler from auto-generating teams at T-30.
  useEffect(() => {
    if (!token) return;
    void blockTeamAutoGen(token, matchId).catch(() => {});
  }, [matchId, token]);

  const slotsPerTeam = Math.floor((match?.capacity ?? 0) / 2);

  // Build confirmed player map for quick lookup
  const playerMap = useMemo(() => {
    const map = new Map<string, ParticipantView>();
    (match?.participants ?? [])
      .filter((p: ParticipantView) => p.status === "CONFIRMED")
      .forEach((p: ParticipantView) => map.set(p.userId, p));
    return map;
  }, [match?.participants]);

  // ── Local editable state ──
  const [teamA, setTeamA] = useState<Slot[]>([]);
  const [teamB, setTeamB] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<SlotId | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Track initialization: reset only when the match id or teamsConfigured flag changes
  const initializedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!match) return;
    const key = `${match.id}:${String(match.teamsConfigured)}`;
    if (initializedFor.current === key) return;
    initializedFor.current = key;

    const n = Math.floor(match.capacity / 2);
    if (match.teamsConfigured && match.teams) {
      setTeamA(match.teams.teamA.map((s) => s.userId));
      setTeamB(match.teams.teamB.map((s) => s.userId));
    } else {
      setTeamA(Array<Slot>(n).fill(null));
      setTeamB(Array<Slot>(n).fill(null));
    }
    setIsDirty(false);
    setSelected(null);
  }, [match?.id, match?.teamsConfigured, match]);

  // Confirmed players not in any slot
  const assignedIds = useMemo(() => {
    const ids = new Set<string>();
    [...teamA, ...teamB].forEach((id) => { if (id) ids.add(id); });
    return ids;
  }, [teamA, teamB]);

  const unassigned = useMemo(
    () =>
      (match?.participants ?? []).filter(
        (p: ParticipantView) => p.status === "CONFIRMED" && !assignedIds.has(p.userId),
      ),
    [match?.participants, assignedIds],
  );

  // ── Slot interaction ──

  function applySlots(newA: Slot[], newB: Slot[]) {
    setTeamA([...newA]);
    setTeamB([...newB]);
    setIsDirty(true);
    setSelected(null);
  }

  function handleSlotPress(target: SlotId) {
    if (!selected) {
      setSelected(target);
      return;
    }
    if (selected.team === target.team && selected.index === target.index) {
      setSelected(null);
      return;
    }
    // Swap the two slots
    const newA = [...teamA];
    const newB = [...teamB];
    const fromVal: Slot = selected.team === "A" ? newA[selected.index] : newB[selected.index];
    const toVal: Slot = target.team === "A" ? newA[target.index] : newB[target.index];
    if (selected.team === "A") newA[selected.index] = toVal;
    else newB[selected.index] = toVal;
    if (target.team === "A") newA[target.index] = fromVal;
    else newB[target.index] = fromVal;
    applySlots(newA, newB);
  }

  function handleUnassignedPress(userId: string) {
    const newA = [...teamA];
    const newB = [...teamB];
    if (selected) {
      if (selected.team === "A") newA[selected.index] = userId;
      else newB[selected.index] = userId;
      applySlots(newA, newB);
      return;
    }
    // Auto-place in first empty slot (A first, then B)
    const emptyA = newA.findIndex((s) => s === null);
    if (emptyA !== -1) {
      newA[emptyA] = userId;
    } else {
      const emptyB = newB.findIndex((s) => s === null);
      if (emptyB !== -1) newB[emptyB] = userId;
    }
    applySlots(newA, newB);
  }

  // ── Actions ──

  function handleRandomize() {
    if (!match) return;
    const confirmed = (match.participants as ParticipantView[])
      .filter((p) => p.status === "CONFIRMED")
      .map((p) => p.userId);
    const [newA, newB] = snakeDraft(shuffleArray(confirmed), slotsPerTeam);
    applySlots(newA, newB);
  }

  function handleBalanced() {
    if (!match) return;
    // Local proxy: sort alphabetically by username, then snake-draft
    const confirmed = (match.participants as ParticipantView[])
      .filter((p) => p.status === "CONFIRMED")
      .sort((a, b) => a.username.localeCompare(b.username))
      .map((p) => p.userId);
    const [newA, newB] = snakeDraft(confirmed, slotsPerTeam);
    applySlots(newA, newB);
  }

  async function handleSave() {
    if (!match || !token) return;
    setSaving(true);
    setError("");
    try {
      const snapshot: MatchSnapshot = await saveTeams(token, matchId, {
        expectedRevision: match.revision,
        teamA,
        teamB,
      });
      // Update cache so MatchDetail reflects new state immediately
      queryClient.setQueryData(["match", matchId], { match: snapshot });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      setIsDirty(false);
      navigation.goBack();
    } catch (err) {
      setError(formatTeamError(err));
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  if (isLoading || !match) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  const confirmedCount = (match.participants as ParticipantView[]).filter(
    (p) => p.status === "CONFIRMED",
  ).length;
  const teamACount = teamA.filter(Boolean).length;
  const teamBCount = teamB.filter(Boolean).length;

  return (
    <View style={s.screen}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Quick-action buttons */}
        <View style={s.actionRow}>
          <Pressable style={s.actionBtn} onPress={handleRandomize} disabled={saving}>
            <Text style={s.actionBtnText}>Aleatorio</Text>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={handleBalanced} disabled={saving}>
            <Text style={s.actionBtnText}>Equilibrado</Text>
          </Pressable>
        </View>

        {/* Teams grid */}
        <View style={s.teamsRow}>
          {/* Team A */}
          <View style={s.teamCol}>
            <Text style={s.teamHeader}>
              Equipo A{" "}
              <Text style={s.teamCounter}>{teamACount}/{slotsPerTeam}</Text>
            </Text>
            {teamA.map((userId, i) => {
              const player = userId ? playerMap.get(userId) : null;
              const isSelected = selected?.team === "A" && selected.index === i;
              return (
                <Pressable
                  key={i}
                  style={[s.slotCard, isSelected && s.slotCardSelected]}
                  onPress={() => handleSlotPress({ team: "A", index: i })}
                >
                  <View style={[s.slotDot, { backgroundColor: "#1565c0" }]} />
                  <Text style={[s.slotText, !player && s.slotEmpty]} numberOfLines={1}>
                    {player ? player.username : "Vacío"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={s.divider} />

          {/* Team B */}
          <View style={s.teamCol}>
            <Text style={s.teamHeader}>
              Equipo B{" "}
              <Text style={s.teamCounter}>{teamBCount}/{slotsPerTeam}</Text>
            </Text>
            {teamB.map((userId, i) => {
              const player = userId ? playerMap.get(userId) : null;
              const isSelected = selected?.team === "B" && selected.index === i;
              return (
                <Pressable
                  key={i}
                  style={[s.slotCard, isSelected && s.slotCardSelected]}
                  onPress={() => handleSlotPress({ team: "B", index: i })}
                >
                  <View style={[s.slotDot, { backgroundColor: "#b71c1c" }]} />
                  <Text style={[s.slotText, !player && s.slotEmpty]} numberOfLines={1}>
                    {player ? player.username : "Vacío"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Unassigned */}
        {unassigned.length > 0 && (
          <View style={s.unassignedSection}>
            <Text style={s.unassignedTitle}>Sin asignar ({unassigned.length})</Text>
            <View style={s.unassignedRow}>
              {unassigned.map((p: ParticipantView) => (
                <Pressable
                  key={p.userId}
                  style={s.unassignedChip}
                  onPress={() => handleUnassignedPress(p.userId)}
                >
                  <Text style={s.unassignedChipText} numberOfLines={1}>
                    {p.username}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Interaction hint */}
        {selected ? (
          <Text style={s.hint}>Tap en otro slot para intercambiar</Text>
        ) : null}

        {/* Stats */}
        <Text style={s.statsText}>
          {confirmedCount} confirmados · {confirmedCount - assignedIds.size} sin asignar
        </Text>

        {/* Error */}
        {error ? <Text style={s.errorText}>{error}</Text> : null}
      </ScrollView>

      {/* Fixed save button */}
      <View style={s.saveBar}>
        <Pressable
          style={[s.saveBtn, (!isDirty || saving) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveBtnText}>
              {match.teamsConfigured ? "Guardar cambios" : "Guardar equipos"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ──

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 10,
    alignItems: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.06)",
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1976d2",
  },
  teamsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 16,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
  },
  teamCol: {
    flex: 1,
    padding: 12,
  },
  divider: {
    width: 1,
    backgroundColor: "#e0e0e0",
  },
  teamHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  teamCounter: {
    fontWeight: "400",
    color: "#888",
  },
  slotCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "#f8f8f8",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  slotCardSelected: {
    borderColor: "#1976d2",
    backgroundColor: "#e3f2fd",
  },
  slotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  slotText: {
    fontSize: 13,
    color: "#222",
    flex: 1,
  },
  slotEmpty: {
    color: "#bbb",
    fontStyle: "italic",
  },
  unassignedSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  unassignedTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  unassignedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  unassignedChip: {
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  unassignedChipText: {
    fontSize: 13,
    color: "#444",
  },
  hint: {
    fontSize: 12,
    color: "#1976d2",
    textAlign: "center",
    marginBottom: 6,
  },
  statsText: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
    marginBottom: 4,
  },
  errorText: {
    color: "#c62828",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 8,
  },
  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    boxShadow: "0px -2px 6px rgba(0,0,0,0.06)",
  },
  saveBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderCurve: "continuous",
  },
  saveBtnDisabled: {
    backgroundColor: "#90caf9",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
