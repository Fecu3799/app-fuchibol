import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { postRegister } from '../features/auth/authClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

// ── Client-side validation ──

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Must match backend: ^[a-z0-9][a-z0-9_]*$, 3-20 chars total
const USERNAME_RE = /^[a-z0-9][a-z0-9_]{2,19}$/;

function validate(
  email: string,
  password: string,
  confirmPassword: string,
  username: string,
): string | null {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  if (!username.trim()) return 'Username is required.';
  if (!USERNAME_RE.test(username.trim())) {
    return 'Username must be 3-20 chars, letters/numbers/underscore, start with a letter or number.';
  }
  return null;
}

// Map backend error to a human-readable message.
function mapApiError(err: ApiError): string {
  if (err.status === 409) {
    const msg = (err.body.message ?? '').toLowerCase();
    if (msg.includes('email')) return 'That email is already registered.';
    if (msg.includes('username')) return 'That username is already taken.';
    return 'An account with that information already exists.';
  }
  if (err.status === 422) return 'Check the form — some fields are invalid.';
  return err.body.detail ?? err.body.message ?? 'Something went wrong. Please try again.';
}

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    const validationError = validate(email, password, confirmPassword, username);
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);
    try {
      await postRegister(
        email.trim().toLowerCase(),
        password,
        username.trim(),
      );
      // Registration succeeded — verify email before allowing login.
      navigation.navigate('VerifyEmail', { email: email.trim().toLowerCase() });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(mapApiError(err));
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
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create account</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />

        <Text style={styles.label}>Username *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. juanfc10"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          editable={!loading}
        />
        <Text style={styles.hint}>3-20 chars, letters/numbers/underscore, start with a letter or number.</Text>

        <Text style={styles.label}>Password *</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Min. 8 chars, 1 uppercase, 1 number"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(v => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color="#999"
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>At least 8 characters, one uppercase letter, one number.</Text>

        <Text style={styles.label}>Confirm password *</Text>
        <TextInput
          style={styles.input}
          placeholder="Repeat password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading || !email || !username || !password || !confirmPassword}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          onPress={() => navigation.navigate('Login')}
          disabled={loading}
        >
          <Text style={styles.linkText}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  form: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 24 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  errorText: { color: '#d32f2f', textAlign: 'center', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4 },
  hint: { fontSize: 11, color: '#999', marginTop: -8, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  // Password row: input + eye toggle
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 12,
  },
  inputFlex: {
    flex: 1,
    padding: 14,
    fontSize: 16,
  },
  eyeBtn: {
    paddingHorizontal: 12,
  },
  button: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#1976d2', fontSize: 14 },
});
