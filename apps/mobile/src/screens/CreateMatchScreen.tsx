import { useState } from 'react';
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
import type { AppStackParamList } from '../navigation/AppNavigator';
import type { PitchType, VenuePitchItem } from '../types/api';
import { useAuth } from '../contexts/AuthContext';
import { createMatch, searchVenuePitches } from '../features/matches/matchesClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateMatch'>;

const PITCH_TYPES: PitchType[] = ['F5', 'F7', 'F9', 'F11'];

const PITCH_CAPACITY: Record<PitchType, number> = {
  F5: 10,
  F7: 14,
  F9: 18,
  F11: 22,
};

function tomorrow20h(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(20, 0, 0, 0);
  return d;
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

// ── Step 1 ──────────────────────────────────────────────────────────────────

interface Step1Props {
  date: Date;
  setDate: (d: Date) => void;
  pitchType: PitchType;
  setPitchType: (t: PitchType) => void;
  loading: boolean;
  error: string;
  onNext: () => void;
}

function Step1({
  date,
  setDate,
  pitchType,
  setPitchType,
  loading,
  error,
  onNext,
}: Step1Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {error ? <Text style={s.error}>{error}</Text> : null}

      <Text style={s.label}>Fecha</Text>
      <Pressable style={s.pickerBtn} onPress={() => setShowDatePicker(true)} disabled={loading}>
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
              next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
              setDate(next);
            }
          }}
        />
      )}

      <Text style={s.label}>Hora</Text>
      <Pressable style={s.pickerBtn} onPress={() => setShowTimePicker(true)} disabled={loading}>
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
          onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}
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
            onPress={() => setPitchType(t)}
            disabled={loading}
          >
            <Text style={[s.pillText, pitchType === t && s.pillTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[s.button, loading && s.buttonDisabled]}
        onPress={onNext}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.buttonText}>Siguiente</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ── Venue pitch card ─────────────────────────────────────────────────────────

interface PitchCardProps {
  item: VenuePitchItem;
  selected: boolean;
  onSelect: () => void;
}

function PitchCard({ item, selected, onSelect }: PitchCardProps) {
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
        <Pressable
          style={s.mapsBtn}
          onPress={() => void Linking.openURL(mapsUrl)}
          hitSlop={8}
        >
          <Text style={s.mapsBtnText}>Ver en mapa</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// ── Step 2 ──────────────────────────────────────────────────────────────────

interface Step2Props {
  pitchType: PitchType;
  pitches: VenuePitchItem[];
  selectedPitch: VenuePitchItem | null;
  onSelect: (p: VenuePitchItem) => void;
  loadingPitches: boolean;
  creating: boolean;
  error: string;
  onBack: () => void;
  onConfirm: () => void;
}

function Step2({
  pitchType,
  pitches,
  selectedPitch,
  onSelect,
  loadingPitches,
  creating,
  error,
  onBack,
  onConfirm,
}: Step2Props) {
  return (
    <View style={s.flex}>
      {error ? <Text style={[s.error, s.errorPadded]}>{error}</Text> : null}

      {loadingPitches ? (
        <ActivityIndicator style={s.loader} size="large" />
      ) : pitches.length === 0 ? (
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
              onSelect={() => onSelect(item)}
            />
          )}
          contentContainerStyle={s.list}
        />
      )}

      <View style={s.footer}>
        <Pressable style={s.backBtn} onPress={onBack} disabled={creating}>
          <Text style={s.backBtnText}>Atrás</Text>
        </Pressable>
        <Pressable
          style={[s.button, s.footerConfirmBtn, (!selectedPitch || creating) && s.buttonDisabled]}
          onPress={onConfirm}
          disabled={!selectedPitch || creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.buttonText}>Crear partido</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Root screen ──────────────────────────────────────────────────────────────

export default function CreateMatchScreen({ navigation }: Props) {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(tomorrow20h);
  const [pitchType, setPitchType] = useState<PitchType>('F5');

  const [pitches, setPitches] = useState<VenuePitchItem[]>([]);
  const [selectedPitch, setSelectedPitch] = useState<VenuePitchItem | null>(null);

  const [loadingPitches, setLoadingPitches] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleNext = async () => {
    setError('');
    setLoadingPitches(true);
    try {
      const res = await searchVenuePitches(token!, pitchType);
      setPitches(res.items);
      setSelectedPitch(null);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) { logout(); return; }
        setError(err.body.detail ?? err.body.message ?? 'Error al buscar canchas.');
      } else {
        setError('Error de conexión. Intentá de nuevo.');
      }
    } finally {
      setLoadingPitches(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedPitch) return;
    setError('');
    setCreating(true);
    try {
      const title = `${selectedPitch.pitchType} en ${selectedPitch.venueName}`;
      const res = await createMatch(token!, {
        title,
        startsAt: date.toISOString(),
        capacity: PITCH_CAPACITY[pitchType],
        venueId: selectedPitch.venueId,
        venuePitchId: selectedPitch.venuePitchId,
      });
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      navigation.replace('MatchDetail', { matchId: res.id });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) { logout(); return; }
        const detail = err.body.detail ?? err.body.message;
        const msg = Array.isArray(detail) ? detail.join(', ') : (detail ?? 'Error');
        setError(msg);
      } else {
        setError('Error de conexión. Intentá de nuevo.');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {step === 1 ? (
        <Step1
          date={date}
          setDate={setDate}
          pitchType={pitchType}
          setPitchType={setPitchType}
          loading={loadingPitches}
          error={error}
          onNext={() => void handleNext()}
        />
      ) : (
        <Step2
          pitchType={pitchType}
          pitches={pitches}
          selectedPitch={selectedPitch}
          onSelect={setSelectedPitch}
          loadingPitches={loadingPitches}
          creating={creating}
          error={error}
          onBack={() => { setStep(1); setError(''); }}
          onConfirm={() => void handleConfirm()}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 12 },

  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 16 },

  pickerBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
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

  error: { color: '#d32f2f', textAlign: 'center', marginBottom: 8 },
  errorPadded: { marginHorizontal: 16, marginTop: 12 },

  loader: { marginTop: 60 },
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardVenue: { fontSize: 16, fontWeight: '700', color: '#111', flex: 1, marginRight: 8 },
  typeBadge: { backgroundColor: '#1976d2', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
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
