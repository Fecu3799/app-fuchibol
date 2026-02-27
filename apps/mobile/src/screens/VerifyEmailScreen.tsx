import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { postEmailVerifyConfirm, postEmailVerifyRequest } from '../features/auth/authClient';
import { ApiError } from '../lib/api';
import { AuthScaffold } from '../components/auth/AuthScaffold';
import { AuthField } from '../components/auth/AuthField';
import { authStyles } from '../components/auth/authStyles';

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
      setError(
        err instanceof ApiError
          ? (err.body.detail ?? err.body.message ?? 'Could not send email.')
          : 'Connection error. Please try again.',
      );
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
      setError(
        err instanceof ApiError
          ? (err.body.detail ?? err.body.message ?? 'Invalid or expired token.')
          : 'Connection error. Please try again.',
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  if (verified) {
    return (
      <AuthScaffold>
        <Text style={authStyles.cardSubtitle}>
          ✓ Email verified! Your account is ready. Sign in to continue.
        </Text>
        <TouchableOpacity
          style={authStyles.btn}
          onPress={() => navigation.navigate('Login', { prefillEmail: email || undefined })}
          activeOpacity={0.8}
        >
          <Text style={authStyles.btnText}>Go to Login</Text>
        </TouchableOpacity>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold>
      <Text style={authStyles.cardSubtitle}>
        {email
          ? `We sent a verification email to ${email}. Paste the token below.`
          : 'Enter your email to receive a verification link.'}
      </Text>

      {error ? <Text style={authStyles.error}>{error}</Text> : null}
      {sendMsg ? <Text style={authStyles.successText}>{sendMsg}</Text> : null}

      {/* Step 1 — request / resend */}
      <AuthField
        label="Email address"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        editable={!busy}
      />
      <TouchableOpacity
        style={[authStyles.btnSecondary, (busy || !email) && authStyles.btnDisabled]}
        onPress={handleRequestEmail}
        disabled={busy || !email}
        activeOpacity={0.8}
      >
        {sendLoading ? (
          <ActivityIndicator color="#1976d2" />
        ) : (
          <Text style={authStyles.btnSecondaryText}>
            {sendMsg ? 'Resend email' : 'Send verification email'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={authStyles.divider} />

      {/* Step 2 — enter token */}
      <AuthField
        label="Verification token"
        placeholder="Paste token from email"
        autoCapitalize="none"
        autoCorrect={false}
        value={token}
        onChangeText={setToken}
        editable={!busy}
      />
      <TouchableOpacity
        style={[authStyles.btn, (busy || !token) && authStyles.btnDisabled]}
        onPress={handleConfirm}
        disabled={busy || !token}
        activeOpacity={0.8}
      >
        {confirmLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={authStyles.btnText}>Confirm</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.link}
        onPress={() => navigation.navigate('Login')}
        disabled={busy}
      >
        <Text style={authStyles.linkText}>Back to login</Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
}
