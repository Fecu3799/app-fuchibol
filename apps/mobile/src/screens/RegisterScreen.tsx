import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import type { PreferredPosition, SkillLevel, UserGender } from '../types/api';
import { postRegister } from '../features/auth/authClient';
import { ApiError } from '../lib/api';
import { AuthScaffold } from '../components/auth/AuthScaffold';
import { AuthField } from '../components/auth/AuthField';
import { authStyles, AUTH_ACCENT } from '../components/auth/authStyles';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

// ── Constants ──

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9][a-z0-9_]{2,19}$/;

const MAX_BIRTH_DATE = new Date();

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

// ── Validation ──

function validate(
  email: string,
  password: string,
  confirmPassword: string,
  username: string,
  acceptTerms: boolean,
): string | null {
  if (!email.trim()) return 'El email es obligatorio.';
  if (!EMAIL_RE.test(email.trim())) return 'Ingresá un email válido.';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe contener al menos una mayúscula.';
  if (!/[0-9]/.test(password)) return 'La contraseña debe contener al menos un número.';
  if (password !== confirmPassword) return 'Las contraseñas no coinciden.';
  if (!username.trim()) return 'El usuario es obligatorio.';
  if (!USERNAME_RE.test(username.trim())) {
    return 'Usuario: 3-20 chars, letras/números/guión_bajo, empezá con letra o número.';
  }
  if (!acceptTerms) return 'Debés aceptar los términos y condiciones.';
  return null;
}

function mapApiError(err: ApiError): string {
  if (err.status === 409) {
    const msg = (err.body.message ?? '').toLowerCase();
    if (msg.includes('email')) return 'Ese email ya está registrado.';
    if (msg.includes('username')) return 'Ese nombre de usuario ya está en uso.';
    return 'Ya existe una cuenta con esa información.';
  }
  if (err.status === 422) {
    if (err.body.code === 'TERMS_NOT_ACCEPTED') return 'Debés aceptar los términos y condiciones.';
    return 'Revisá el formulario — algunos campos son inválidos.';
  }
  return err.body.detail ?? err.body.message ?? 'Algo salió mal. Intentá de nuevo.';
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
  onSelect: (v: T) => void;
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
            onPress={() => onSelect(opt.value)}
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

export default function RegisterScreen({ navigation }: Props) {
  // Required fields
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Optional profile fields
  const [showOptional, setShowOptional] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<UserGender | null>(null);
  const [preferredPosition, setPreferredPosition] = useState<PreferredPosition | null>(null);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    const validationError = validate(email, password, confirmPassword, username, acceptTerms);
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);
    try {
      await postRegister({
        email: email.trim().toLowerCase(),
        password,
        username: username.trim(),
        acceptTerms: true,
        ...(firstName.trim() && { firstName: firstName.trim() }),
        ...(lastName.trim() && { lastName: lastName.trim() }),
        ...(birthDate && { birthDate: toISODate(birthDate) }),
        ...(gender && { gender }),
        ...(preferredPosition && { preferredPosition }),
        ...(skillLevel && { skillLevel }),
      });
      navigation.navigate('VerifyEmail', { email: email.trim().toLowerCase() });
    } catch (err) {
      setError(err instanceof ApiError ? mapApiError(err) : 'Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && !!email && !!username && !!password && !!confirmPassword && acceptTerms;

  return (
    <AuthScaffold>
      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <AuthField
        label="Email *"
        placeholder="vos@ejemplo.com"
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <AuthField
        label="Usuario *"
        hint="3-20 chars, letras/números/guión_bajo, empezá con letra o número."
        placeholder="ej. juanfc10"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        editable={!loading}
      />

      <AuthField
        label="Contraseña *"
        hint="Al menos 8 caracteres, una mayúscula y un número."
        placeholder="Mín. 8 chars, 1 mayúscula, 1 número"
        secureToggle
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <AuthField
        label="Confirmar contraseña *"
        placeholder="Repetí la contraseña"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!loading}
      />

      {/* Terms checkbox */}
      <TouchableOpacity
        style={s.checkRow}
        onPress={() => setAcceptTerms((v) => !v)}
        disabled={loading}
        activeOpacity={0.7}
      >
        <View style={[s.checkbox, acceptTerms && s.checkboxChecked]}>
          {acceptTerms ? <Text style={s.checkmark}>✓</Text> : null}
        </View>
        <Text style={s.checkLabel}>Acepto los términos y condiciones *</Text>
      </TouchableOpacity>

      {/* Optional profile section toggle */}
      <TouchableOpacity
        style={s.optionalToggle}
        onPress={() => setShowOptional((v) => !v)}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={s.optionalToggleText}>
          {showOptional ? '▲ Ocultar perfil opcional' : '▼ Completar perfil (opcional)'}
        </Text>
      </TouchableOpacity>

      {showOptional && (
        <View style={s.optionalSection}>
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
            <TouchableOpacity
              style={s.dateConfirmBtn}
              onPress={() => setShowDatePicker(false)}
            >
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
        </View>
      )}

      <TouchableOpacity
        style={[authStyles.btn, !canSubmit && authStyles.btnDisabled, { marginTop: 16 }]}
        onPress={handleRegister}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={authStyles.btnText}>Crear cuenta</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.link}
        onPress={() => navigation.navigate('Login')}
        disabled={loading}
      >
        <Text style={authStyles.linkText}>¿Ya tenés cuenta? Iniciá sesión</Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
}

// ── Styles ──

const s = StyleSheet.create({
  // Checkbox
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#bbb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: AUTH_ACCENT,
    backgroundColor: AUTH_ACCENT,
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },

  // Optional section
  optionalToggle: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  optionalToggleText: {
    color: AUTH_ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  optionalSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginBottom: 4,
  },

  // Date picker
  dateRow: {
    borderWidth: 1,
    borderColor: '#d5d5d5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
    marginBottom: 10,
  },
  dateText: {
    fontSize: 15,
    color: '#444',
  },
  dateConfirmBtn: {
    alignItems: 'flex-end',
    paddingRight: 4,
    marginBottom: 8,
  },
  dateConfirmText: {
    color: AUTH_ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },

  // Pill selector
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#f5f5f5',
  },
  pillActive: {
    borderColor: AUTH_ACCENT,
    backgroundColor: AUTH_ACCENT,
  },
  pillText: {
    fontSize: 13,
    color: '#555',
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
