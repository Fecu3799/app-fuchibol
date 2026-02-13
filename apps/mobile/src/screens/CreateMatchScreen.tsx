import { useState } from 'react';
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
import type { AppStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { createMatch } from '../features/matches/matchesClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateMatch'>;

const FORMATS = ['F5', 'F7', 'F8', 'F11'] as const;
type Format = (typeof FORMATS)[number];

const FORMAT_CAPACITY: Record<Format, number> = {
  F5: 10,
  F7: 14,
  F8: 16,
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateMatchScreen({ navigation }: Props) {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<Format>('F5');
  const [date, setDate] = useState(tomorrow20h);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const capacity = FORMAT_CAPACITY[format];
  const canSubmit = title.trim().length > 0 && !loading;

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await createMatch(token!, {
        title: title.trim(),
        startsAt: date.toISOString(),
        capacity,
      });
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      navigation.replace('MatchDetail', { matchId: res.id });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          logout();
          return;
        }
        const msg = Array.isArray(err.body.message)
          ? err.body.message.join(', ')
          : err.body.message;
        setError(msg);
      } else {
        setError('Connection error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Futbol 5 Friday"
          value={title}
          onChangeText={setTitle}
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
              <Text style={[styles.segmentText, format === f && styles.segmentTextActive]}>
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
        <Pressable style={styles.pickerBtn} onPress={() => setShowDatePicker(true)} disabled={loading}>
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
                next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                setDate(next);
              }
            }}
          />
        )}

        <Text style={styles.label}>Time</Text>
        <Pressable style={styles.pickerBtn} onPress={() => setShowTimePicker(true)} disabled={loading}>
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
            onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Match</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 16 },
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
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12, marginTop: 4 },
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
