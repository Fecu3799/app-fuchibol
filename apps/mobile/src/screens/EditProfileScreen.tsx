import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { PreferredPosition, SkillLevel, UserGender } from '../types/api';
import { patchMe } from '../features/auth/authClient';
import { ApiError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { AuthScaffold } from '../components/auth/AuthScaffold';
import { AuthField } from '../components/auth/AuthField';
import { authStyles, AUTH_ACCENT } from '../components/auth/authStyles';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

// ── Constants ──

const GENDER_OPTIONS: { label: string; value: UserGender }[] = [
  { label: 'Masculino', value: 'MALE' },
  { label: 'Femenino', value: 'FEMALE' },
  { label: 'Otro', value: 'OTHER' },
];

const POSITION_OPTIONS: { label: string; value: PreferredPosition }[] = [
  { label: 'Arquero', value: 'GOALKEEPER' },
  { label: 'Defensor', value: 'DEFENDER' },
  { label: 'Mediocampista', value: 'MIDFIELDER' },
  { label: 'Delantero', value: 'FORWARD' },
];

const SKILL_OPTIONS: { label: string; value: SkillLevel }[] = [
  { label: 'Principiante', value: 'BEGINNER' },
  { label: 'Amateur', value: 'AMATEUR' },
  { label: 'Regular', value: 'REGULAR' },
  { label: 'Semiprofesional', value: 'SEMIPRO' },
  { label: 'Profesional', value: 'PRO' },
];

const MAX_BIRTH_DATE = new Date();

// ── Helpers ──

function formatDisplayDate(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
}

function toISODate(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// ── Pill selector ──

function PillRow<T extends string>({
  options,
  selected,
  onSelect,
  disabled,
}: {
  options: { label: string; value: T }[];
  selected: T | null;
  onSelect: (v: T | null) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.pillRow}>
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[s.pill, active && s.pillActive]}
            onPress={() => onSelect(active ? null : opt.value)}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Text style={[s.pillText, active && s.pillTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Screen ──

export default function EditProfileScreen({ navigation }: Props) {
  const { user, refreshUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [birthDate, setBirthDate] = useState<Date | null>(
    user?.birthDate ? new Date(user.birthDate) : null,
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<UserGender | null>(user?.gender ?? null);
  const [preferredPosition, setPreferredPosition] = useState<PreferredPosition | null>(
    user?.preferredPosition ?? null,
  );
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(user?.skillLevel ?? null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      await patchMe({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        birthDate: birthDate ? toISODate(birthDate) : null,
        gender,
        preferredPosition,
        skillLevel,
      });
      await refreshUser();
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.detail ?? err.body.message ?? 'Error al guardar. Intentá de nuevo.');
      } else {
        setError('Error de conexión. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold>
      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      {/* Email — read-only */}
      <View style={s.readOnlyRow}>
        <Text style={s.readOnlyLabel}>Email</Text>
        <Text style={s.readOnlyValue}>{user?.email ?? '—'}</Text>
      </View>

      <AuthField
        label="Nombre"
        placeholder="Juan"
        autoCorrect={false}
        value={firstName}
        onChangeText={setFirstName}
        editable={!loading}
      />

      <AuthField
        label="Apellido"
        placeholder="García"
        autoCorrect={false}
        value={lastName}
        onChangeText={setLastName}
        editable={!loading}
      />

      {/* Birth date */}
      <Text style={authStyles.label}>Fecha de nacimiento</Text>
      <TouchableOpacity
        style={s.dateRow}
        onPress={() => setShowDatePicker((v) => !v)}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={s.dateText}>
          {birthDate ? formatDisplayDate(birthDate) : 'Seleccionar fecha'}
        </Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={birthDate ?? new Date(2000, 0, 1)}
          mode="date"
          display="spinner"
          maximumDate={MAX_BIRTH_DATE}
          onChange={(_, selected) => {
            if (Platform.OS !== 'ios') setShowDatePicker(false);
            if (selected) setBirthDate(selected);
          }}
        />
      )}
      {showDatePicker && Platform.OS === 'ios' && (
        <TouchableOpacity style={s.dateConfirmBtn} onPress={() => setShowDatePicker(false)}>
          <Text style={s.dateConfirmText}>Listo</Text>
        </TouchableOpacity>
      )}

      {/* Gender */}
      <Text style={[authStyles.label, { marginTop: 8 }]}>Género</Text>
      <PillRow options={GENDER_OPTIONS} selected={gender} onSelect={setGender} disabled={loading} />

      {/* Position */}
      <Text style={[authStyles.label, { marginTop: 10 }]}>Posición preferida</Text>
      <PillRow options={POSITION_OPTIONS} selected={preferredPosition} onSelect={setPreferredPosition} disabled={loading} />

      {/* Skill level */}
      <Text style={[authStyles.label, { marginTop: 10 }]}>Nivel de juego</Text>
      <PillRow options={SKILL_OPTIONS} selected={skillLevel} onSelect={setSkillLevel} disabled={loading} />

      <TouchableOpacity
        style={[authStyles.btn, loading && authStyles.btnDisabled, { marginTop: 20 }]}
        onPress={handleSave}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={authStyles.btnText}>Guardar cambios</Text>
        )}
      </TouchableOpacity>
    </AuthScaffold>
  );
}

const s = StyleSheet.create({
  readOnlyRow: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 14,
  },
  readOnlyLabel: { fontSize: 11, color: '#999', marginBottom: 2 },
  readOnlyValue: { fontSize: 15, color: '#555' },

  dateRow: {
    borderWidth: 1,
    borderColor: '#d5d5d5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
    marginBottom: 10,
  },
  dateText: { fontSize: 15, color: '#444' },
  dateConfirmBtn: { alignItems: 'flex-end', paddingRight: 4, marginBottom: 8 },
  dateConfirmText: { color: AUTH_ACCENT, fontSize: 14, fontWeight: '600' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pill: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#f5f5f5',
  },
  pillActive: { borderColor: AUTH_ACCENT, backgroundColor: AUTH_ACCENT },
  pillText: { fontSize: 13, color: '#555' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
});
