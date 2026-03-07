import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { PitchType, VenuePitchItem } from '../types/api';
import { useAuth } from '../contexts/AuthContext';
import { useMatch } from '../features/matches/useMatch';
import { patchMatch, searchVenuePitches } from '../features/matches/matchesClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'EditMatch'>;

const PITCH_TYPES: PitchType[] = ['F5', 'F7', 'F9', 'F11'];

const PITCH_CAPACITY: Record<PitchType, number> = {
  F5: 10,
  F7: 14,
  F9: 18,
  F11: 22,
};

function derivePitchType(match: {
  pitchSnapshot?: { pitchType?: string } | null;
  capacity: number;
}): PitchType {
  const fromSnapshot = match.pitchSnapshot?.pitchType as PitchType | undefined;
  if (fromSnapshot && (PITCH_TYPES as string[]).includes(fromSnapshot)) return fromSnapshot;
  for (const t of PITCH_TYPES) {
    if (PITCH_CAPACITY[t] === match.capacity) return t;
  }
  for (const t of PITCH_TYPES) {
    if (PITCH_CAPACITY[t] >= match.capacity) return t;
  }
  return 'F11';
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDate(d: Date): string {
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatPrice(price: number | null): string {
  if (price == null) return 'Precio no informado';
  return `$${price.toLocaleString('es-AR')}`;
}

function buildMapsUrl(item: VenuePitchItem): string | null {
  if (item.venueMapsUrl) return item.venueMapsUrl;
  if (item.venueLatitude != null && item.venueLongitude != null) {
    return `https://maps.google.com/?q=${item.venueLatitude},${item.venueLongitude}`;
  }
  return null;
}

function mapError(err: unknown): string {
  if (err instanceof ApiError) {
    const code = err.body.code as string | undefined;
    if (code === 'REVISION_CONFLICT') return 'El partido fue modificado. Volvé y volvé a intentar.';
    if (code === 'MATCH_LOCKED') return 'El partido está bloqueado. Desbloquealo primero.';
    if (code === 'MATCH_EDIT_FROZEN') return 'No se puede editar con menos de 1 hora de anticipación.';
    const detail = err.body.detail ?? err.body.message;
    return Array.isArray(detail) ? (detail as string[]).join(', ') : ((detail as string | undefined) ?? 'Error');
  }
  return 'Error de conexión. Intentá de nuevo.';
}

// ── Pitch card ────────────────────────────────────────────────────────────────

function PitchCard({
  item,
  selected,
  onSelect,
}: {
  item: VenuePitchItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const mapsUrl = buildMapsUrl(item);
  return (
    <Pressable
      style={[s.card, selected && s.cardSelected]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={s.cardHeader}>
        <Text style={s.cardVenue} numberOfLines={1}>{item.venueName}</Text>
        <View style={s.typeBadge}>
          <Text style={s.typeBadgeText}>{item.pitchType}</Text>
        </View>
      </View>
      <Text style={s.cardPitch}>{item.venuePitchName}</Text>
      <Text style={s.cardPrice}>{formatPrice(item.price)}</Text>
      {item.venueAddressText ? (
        <Text style={s.cardAddress} numberOfLines={1}>{item.venueAddressText}</Text>
      ) : null}
      {mapsUrl ? (
        <Pressable style={s.mapsBtn} onPress={() => void Linking.openURL(mapsUrl)} hitSlop={8}>
          <Text style={s.mapsBtnText}>Ver en mapa</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// ── Root screen ───────────────────────────────────────────────────────────────

export default function EditMatchScreen({ route, navigation }: Props) {
  const { matchId } = route.params;
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: match } = useMatch(matchId);

  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(new Date());
  const [pitchType, setPitchType] = useState<PitchType>('F5');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [pitches, setPitches] = useState<VenuePitchItem[]>([]);
  const [selectedPitch, setSelectedPitch] = useState<VenuePitchItem | null>(null);

  const [loadingPitches, setLoadingPitches] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (match && !initialized) {
      setDate(new Date(match.startsAt));
      setPitchType(derivePitchType(match));
      setInitialized(true);
    }
  }, [match, initialized]);

  const handlePitchTypeChange = (t: PitchType) => {
    setPitchType(t);
    setSelectedPitch(null);
  };

  // Step 1: save only date/time changes, no venue change
  const handleSaveDateOnly = async () => {
    if (!match || !token) return;
    const startsAtChanged =
      date.toISOString() !== new Date(match.startsAt).toISOString();
    if (!startsAtChanged) {
      navigation.goBack();
      return;
    }
    setError('');
    setSaving(true);
    try {
      await patchMatch(token, matchId, {
        expectedRevision: match.revision,
        startsAt: date.toISOString(),
      });
      await queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { logout(); return; }
      setError(mapError(err));
    } finally {
      setSaving(false);
    }
  };

  // Step 1 → Step 2: load pitches for the selected type
  const handleShowPitches = async () => {
    if (!match || !token) return;
    setError('');
    setLoadingPitches(true);
    try {
      const res = await searchVenuePitches(token, pitchType);
      setPitches(res.items);
      // Pre-select current pitch if it appears in the list for this type
      const current = res.items.find((p) => p.venuePitchId === match.venuePitchId);
      setSelectedPitch(current ?? null);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { logout(); return; }
      setError(mapError(err));
    } finally {
      setLoadingPitches(false);
    }
  };

  // Step 2: save with new pitch + date
  const handleSaveWithPitch = async () => {
    if (!match || !token || !selectedPitch) return;
    setError('');
    setSaving(true);
    try {
      const pitchChanged = selectedPitch.venuePitchId !== match.venuePitchId;
      const body: Record<string, unknown> & { expectedRevision: number } = {
        expectedRevision: match.revision,
        startsAt: date.toISOString(),
      };
      if (pitchChanged) {
        body.title = `${selectedPitch.pitchType} en ${selectedPitch.venueName}`;
        body.capacity = PITCH_CAPACITY[pitchType];
        body.venueId = selectedPitch.venueId;
        body.venuePitchId = selectedPitch.venuePitchId;
      }
      await patchMatch(token, matchId, body);
      await queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { logout(); return; }
      setError(mapError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!match) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ── Step 1: date + type ───────────────────────────────────────────────────
  if (step === 1) {
    return (
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          {error ? <Text style={s.error}>{error}</Text> : null}

          <Text style={s.label}>Fecha</Text>
          <Pressable
            style={s.pickerBtn}
            onPress={() => setShowDatePicker(true)}
            disabled={saving || loadingPitches}
          >
            <Text style={s.pickerBtnText}>{formatDate(date)}</Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              onChange={(_, selected) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selected) {
                  const next = new Date(date);
                  next.setFullYear(
                    selected.getFullYear(),
                    selected.getMonth(),
                    selected.getDate(),
                  );
                  setDate(next);
                }
              }}
            />
          )}

          <Text style={s.label}>Hora</Text>
          <Pressable
            style={s.pickerBtn}
            onPress={() => setShowTimePicker(true)}
            disabled={saving || loadingPitches}
          >
            <Text style={s.pickerBtnText}>{formatTime(date)}</Text>
          </Pressable>
          {showTimePicker && (
            <DateTimePicker
              value={date}
              mode="time"
              display="spinner"
              is24Hour
              onChange={(_, selected) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (selected) {
                  const next = new Date(date);
                  next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                  setDate(next);
                }
              }}
            />
          )}

          {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
            <Pressable
              style={s.doneBtn}
              onPress={() => {
                setShowDatePicker(false);
                setShowTimePicker(false);
              }}
            >
              <Text style={s.doneBtnText}>Listo</Text>
            </Pressable>
          )}

          <Text style={s.label}>Tipo de cancha</Text>
          <View style={s.pillRow}>
            {PITCH_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[s.pill, pitchType === t && s.pillActive]}
                onPress={() => handlePitchTypeChange(t)}
                disabled={saving || loadingPitches}
              >
                <Text style={[s.pillText, pitchType === t && s.pillTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[s.button, (saving || loadingPitches) && s.buttonDisabled]}
            onPress={() => void handleSaveDateOnly()}
            disabled={saving || loadingPitches}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>Guardar cambios</Text>
            )}
          </Pressable>

          <Pressable
            style={[s.buttonSecondary, (saving || loadingPitches) && s.buttonDisabled]}
            onPress={() => void handleShowPitches()}
            disabled={saving || loadingPitches}
          >
            {loadingPitches ? (
              <ActivityIndicator color="#1976d2" />
            ) : (
              <Text style={s.buttonSecondaryText}>Ver canchas {pitchType} →</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2: pitch list ────────────────────────────────────────────────────
  return (
    <View style={s.flex}>
      {error ? <Text style={[s.error, s.errorPadded]}>{error}</Text> : null}

      {pitches.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyText}>No hay canchas configuradas para {pitchType}</Text>
        </View>
      ) : (
        <FlatList
          data={pitches}
          keyExtractor={(item) => item.venuePitchId}
          renderItem={({ item }) => (
            <PitchCard
              item={item}
              selected={selectedPitch?.venuePitchId === item.venuePitchId}
              onSelect={() => setSelectedPitch(item)}
            />
          )}
          contentContainerStyle={s.list}
        />
      )}

      <View style={s.footer}>
        <Pressable
          style={s.backBtn}
          onPress={() => { setStep(1); setError(''); }}
          disabled={saving}
        >
          <Text style={s.backBtnText}>Atrás</Text>
        </Pressable>
        <Pressable
          style={[s.button, s.footerConfirmBtn, (!selectedPitch || saving) && s.buttonDisabled]}
          onPress={() => void handleSaveWithPitch()}
          disabled={!selectedPitch || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.buttonText}>Guardar con esta cancha</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 16 },

  pickerBtn: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  pickerBtnText: { fontSize: 16, color: '#333' },

  doneBtn: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12, marginTop: 4 },
  doneBtnText: { fontSize: 15, fontWeight: '600', color: '#1976d2' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pillActive: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  pillText: { fontSize: 15, fontWeight: '600', color: '#555' },
  pillTextActive: { color: '#fff' },

  button: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonSecondaryText: { color: '#1976d2', fontSize: 16, fontWeight: '600' },

  error: { color: '#d32f2f', textAlign: 'center', marginBottom: 8 },
  errorPadded: { marginHorizontal: 16, marginTop: 12 },

  list: { padding: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  cardSelected: { borderColor: '#1976d2', backgroundColor: '#f0f6ff' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardVenue: { fontSize: 16, fontWeight: '700', color: '#111', flex: 1, marginRight: 8 },
  typeBadge: {
    backgroundColor: '#1976d2',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardPitch: { fontSize: 13, color: '#555', marginBottom: 4 },
  cardPrice: { fontSize: 14, fontWeight: '600', color: '#2e7d32', marginBottom: 2 },
  cardAddress: { fontSize: 12, color: '#888' },
  mapsBtn: { marginTop: 8, alignSelf: 'flex-start' },
  mapsBtnText: { fontSize: 13, color: '#1976d2', fontWeight: '500' },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  backBtnText: { fontSize: 16, fontWeight: '600', color: '#555' },
  footerConfirmBtn: { flex: 2, marginTop: 0 },
});
