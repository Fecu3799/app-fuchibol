import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { postRegister } from '../features/auth/authClient';
import { ApiError } from '../lib/api';
import { AuthScaffold } from '../components/auth/AuthScaffold';
import { AuthField } from '../components/auth/AuthField';
import { authStyles } from '../components/auth/authStyles';

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
      navigation.navigate('VerifyEmail', { email: email.trim().toLowerCase() });
    } catch (err) {
      setError(err instanceof ApiError ? mapApiError(err) : 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && !!email && !!username && !!password && !!confirmPassword;

  return (
    <AuthScaffold>
      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <AuthField
        label="Email *"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <AuthField
        label="Username *"
        hint="3-20 chars, letters/numbers/underscore, start with a letter or number."
        placeholder="e.g. juanfc10"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        editable={!loading}
      />

      <AuthField
        label="Password *"
        hint="At least 8 characters, one uppercase letter, one number."
        placeholder="Min. 8 chars, 1 uppercase, 1 number"
        secureToggle
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <AuthField
        label="Confirm password *"
        placeholder="Repeat password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!loading}
      />

      <TouchableOpacity
        style={[authStyles.btn, !canSubmit && authStyles.btnDisabled]}
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
