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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { postEmailVerifyConfirm, postEmailVerifyRequest } from '../features/auth/authClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const { identifier } = route.params ?? {};

  // Pre-fill email if identifier looks like an email address.
  const [email, setEmail] = useState(identifier?.includes('@') ? identifier : '');
  const [token, setToken] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [error, setError] = useState('');

  const handleRequestEmail = async () => {
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setError('');
    setSendMsg('');
    setSendLoading(true);
    try {
      await postEmailVerifyRequest(email.trim().toLowerCase());
      setSendMsg('Verification email sent. Check your inbox.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.detail ?? err.body.message ?? 'Could not send email.');
      } else {
        setError('Connection error. Please try again.');
      }
    } finally {
      setSendLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!token.trim()) { setError('Paste the verification token.'); return; }
    setError('');
    setConfirmLoading(true);
    try {
      await postEmailVerifyConfirm(token.trim());
      // Verified — go back to login so the user can sign in.
      navigation.navigate('Login');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.detail ?? err.body.message ?? 'Invalid or expired token.');
      } else {
        setError('Connection error. Please try again.');
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          You need to verify your email before logging in.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {sendMsg ? <Text style={styles.success}>{sendMsg}</Text> : null}

        {/* Step 1 — Request email */}
        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!sendLoading && !confirmLoading}
        />
        <TouchableOpacity
          style={[styles.button, sendLoading && styles.buttonDisabled]}
          onPress={handleRequestEmail}
          disabled={sendLoading || !email}
        >
          {sendLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send verification email</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Step 2 — Enter token */}
        <Text style={styles.label}>Verification token</Text>
        <TextInput
          style={styles.input}
          placeholder="Paste token from email"
          autoCapitalize="none"
          autoCorrect={false}
          value={token}
          onChangeText={setToken}
          editable={!sendLoading && !confirmLoading}
        />
        <TouchableOpacity
          style={[styles.button, styles.buttonConfirm, confirmLoading && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={confirmLoading || !token}
        >
          {confirmLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Confirm</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.back} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.backText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center' },
  form: { paddingHorizontal: 32 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4 },
  error: { color: '#d32f2f', textAlign: 'center', marginBottom: 12 },
  success: { color: '#388e3c', textAlign: 'center', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonConfirm: { backgroundColor: '#388e3c' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 24 },
  back: { marginTop: 20, alignItems: 'center' },
  backText: { color: '#1976d2', fontSize: 14 },
});
