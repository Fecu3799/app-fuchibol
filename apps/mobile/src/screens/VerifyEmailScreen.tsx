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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { postEmailVerifyConfirm, postEmailVerifyRequest } from '../features/auth/authClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [token, setToken] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const busy = sendLoading || confirmLoading;

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
    if (!token.trim()) { setError('Paste the verification token from the email.'); return; }
    setError('');
    setConfirmLoading(true);
    try {
      await postEmailVerifyConfirm(token.trim());
      setVerified(true);
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

  // ── Success view ──
  if (verified) {
    return (
      <View style={styles.container}>
        <View style={styles.successBox}>
          <Text style={styles.successTitle}>Email verified!</Text>
          <Text style={styles.successSubtitle}>
            Your account is ready. Sign in to continue.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Login', { prefillEmail: email || undefined })}
          >
            <Text style={styles.buttonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Verification form ──
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          {email
            ? `We sent a verification email to ${email}. Paste the token below.`
            : 'Enter your email to receive a verification link.'}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {sendMsg ? <Text style={styles.successText}>{sendMsg}</Text> : null}

        {/* Step 1 — Request / resend email */}
        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />
        <TouchableOpacity
          style={[styles.buttonSecondary, sendLoading && styles.buttonDisabled]}
          onPress={handleRequestEmail}
          disabled={busy || !email}
        >
          {sendLoading ? (
            <ActivityIndicator color="#1976d2" />
          ) : (
            <Text style={styles.buttonSecondaryText}>
              {sendMsg ? 'Resend email' : 'Send verification email'}
            </Text>
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
          editable={!busy}
        />
        <TouchableOpacity
          style={[styles.button, confirmLoading && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={busy || !token}
        >
          {confirmLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Confirm</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          onPress={() => navigation.navigate('Login')}
          disabled={busy}
        >
          <Text style={styles.linkText}>Back to login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  // success view
  successBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successTitle: { fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  successSubtitle: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 32 },
  // form view
  form: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 24 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4 },
  errorText: { color: '#d32f2f', textAlign: 'center', marginBottom: 12 },
  successText: { color: '#388e3c', textAlign: 'center', marginBottom: 12 },
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
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonSecondaryText: { color: '#1976d2', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 24 },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#1976d2', fontSize: 14 },
});
