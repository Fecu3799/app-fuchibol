import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { useMatch } from '../features/matches/useMatch';
import { patchMatch } from '../features/matches/matchesClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'EditMatch'>;

// Same format/capacity mapping as CreateMatchScreen
const FORMATS = ['F5', 'F7', 'F8', 'F11'] as const;
type Format = (typeof FORMATS)[number];

const FORMAT_CAPACITY: Record<Format, number> = {
  F5: 10,
  F7: 14,
  F8: 16,
  F11: 22,
};

/** Reverse-map capacity → format. Falls back to closest match. */
function capacityToFormat(cap: number): Format {
  for (const f of FORMATS) {
    if (FORMAT_CAPACITY[f] === cap) return f;
  }
  // Fallback: pick the format whose capacity is closest (>=)
  for (const f of FORMATS) {
    if (FORMAT_CAPACITY[f] >= cap) return f;
  }
  return 'F11';
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditMatchScreen({ route, navigation }: Props) {
  const { matchId } = route.params;
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: match } = useMatch(matchId);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [format, setFormat] = useState<Format>('F5');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  const capacity = FORMAT_CAPACITY[format];

  // Pre-fill form when match loads
  useEffect(() => {
    if (match && !initialized) {
      setTitle(match.title);
      setLocation(match.location ?? '');
      setFormat(capacityToFormat(match.capacity));
      setDate(new Date(match.startsAt));
      setInitialized(true);
    }
  }, [match, initialized]);

  const canSubmit = title.trim().length > 0 && !loading;

  const handleSave = async () => {
    if (!match || !token) return;
    setError('');
    setLoading(true);
    try {
      const body: Record<string, unknown> & { expectedRevision: number } = {
        expectedRevision: match.revision,
      };

      if (title.trim() !== match.title) body.title = title.trim();
      if (location.trim() !== (match.location ?? ''))
        body.location = location.trim() || null;
      if (capacity !== match.capacity) body.capacity = capacity;
      if (date.toISOString() !== new Date(match.startsAt).toISOString())
        body.startsAt = date.toISOString();

      await patchMatch(token, matchId, body);
      await queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          logout();
          return;
        }
        const code = err.body.code;
        if (code === 'REVISION_CONFLICT') {
          setError('Match was updated by someone else. Go back and try again.');
        } else if (code === 'MATCH_LOCKED') {
          setError('Match is locked. Unlock it first.');
        } else {
          const detail = err.body.detail ?? err.body.message;
          setError(
            Array.isArray(detail) ? detail.join(', ') : (detail ?? 'Error'),
          );
        }
      } else {
        setError('Connection error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!match) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          editable={!loading}
        />

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="Optional"
          value={location}
          onChangeText={setLocation}
          editable={!loading}
        />

        <Text style={styles.label}>Format</Text>
        <View style={styles.segmented}>
          {FORMATS.map((f) => (
            <Pressable
              key={f}
              style={[styles.segment, format === f && styles.segmentActive]}
              onPress={() => setFormat(f)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.segmentText,
                  format === f && styles.segmentTextActive,
                ]}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Capacity</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{capacity} players</Text>
        </View>

        <Text style={styles.label}>Date</Text>
        <Pressable
          style={styles.pickerBtn}
          onPress={() => setShowDatePicker(true)}
          disabled={loading}
        >
          <Text style={styles.pickerBtnText}>{formatDate(date)}</Text>
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

        <Text style={styles.label}>Time</Text>
        <Pressable
          style={styles.pickerBtn}
          onPress={() => setShowTimePicker(true)}
          disabled={loading}
        >
          <Text style={styles.pickerBtnText}>{formatTime(date)}</Text>
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
            style={styles.doneBtn}
            onPress={() => {
              setShowDatePicker(false);
              setShowTimePicker(false);
            }}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save Changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 12 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  segmented: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  segmentText: { fontSize: 15, fontWeight: '600', color: '#555' },
  segmentTextActive: { color: '#fff' },
  readOnlyField: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  readOnlyText: { fontSize: 16, color: '#333' },
  pickerBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  pickerBtnText: { fontSize: 16, color: '#333' },
  doneBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  doneBtnText: { fontSize: 15, fontWeight: '600', color: '#1976d2' },
  error: { color: '#d32f2f', textAlign: 'center', marginBottom: 8 },
  button: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
