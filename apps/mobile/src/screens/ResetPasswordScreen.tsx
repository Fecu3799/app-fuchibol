import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { postPasswordResetConfirm } from '../features/auth/authClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;

export default function ResetPasswordScreen({ navigation }: Props) {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const validate = (): string => {
    if (!token.trim()) return 'Please enter the reset code from your email.';
    if (!PASSWORD_RE.test(newPassword))
      return 'Password must be at least 8 characters with 1 uppercase letter and 1 number.';
    return '';
  };

  const handleSubmit = async () => {
    const msg = validate();
    if (msg) { setError(msg); return; }
    setError('');
    setLoading(true);
    try {
      await postPasswordResetConfirm(token.trim(), newPassword);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_OR_EXPIRED_TOKEN') {
        setError('This reset code is invalid or has expired. Please request a new one.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <View style={styles.form}>
          <Text style={styles.title}>Password updated</Text>
          <Text style={styles.subtitle}>Your password has been reset. You can now log in with your new password.</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login', {})}>
            <Text style={styles.buttonText}>Go to login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Paste the code from your email and choose a new password.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Reset code"
          autoCapitalize="none"
          autoCorrect={false}
          value={token}
          onChangeText={setToken}
          editable={!loading}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            placeholder="New password"
            secureTextEntry={!showPassword}
            value={newPassword}
            onChangeText={setNewPassword}
            editable={!loading}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, (loading || !token || !newPassword) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !token || !newPassword}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Set new password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          onPress={() => navigation.navigate('ForgotPassword')}
          disabled={loading}
        >
          <Text style={styles.linkText}>Didn't receive a code?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center' },
  form: { paddingHorizontal: 32 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  error: { color: '#d32f2f', textAlign: 'center', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 12,
  },
  inputFlex: { flex: 1, padding: 14, fontSize: 16 },
  eyeBtn: { paddingHorizontal: 14 },
  button: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#1976d2', fontSize: 14 },
});
