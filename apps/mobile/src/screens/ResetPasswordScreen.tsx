import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { postPasswordResetConfirm } from '../features/auth/authClient';
import { ApiError } from '../lib/api';
import { AuthScaffold } from '../components/auth/AuthScaffold';
import { AuthField } from '../components/auth/AuthField';
import { authStyles } from '../components/auth/authStyles';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;

export default function ResetPasswordScreen({ navigation }: Props) {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
      <AuthScaffold>
        <Text style={authStyles.cardSubtitle}>
          ✓ Your password has been reset. You can now log in with your new password.
        </Text>
        <TouchableOpacity
          style={authStyles.btn}
          onPress={() => navigation.navigate('Login', {})}
          activeOpacity={0.8}
        >
          <Text style={authStyles.btnText}>Go to login</Text>
        </TouchableOpacity>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold>
      <Text style={authStyles.cardSubtitle}>
        Paste the code from your email and choose a new password.
      </Text>

      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <AuthField
        placeholder="Reset code"
        autoCapitalize="none"
        autoCorrect={false}
        value={token}
        onChangeText={setToken}
        editable={!loading}
      />

      <AuthField
        placeholder="New password"
        secureToggle
        value={newPassword}
        onChangeText={setNewPassword}
        editable={!loading}
      />

      <TouchableOpacity
        style={[authStyles.btn, (loading || !token || !newPassword) && authStyles.btnDisabled]}
        onPress={handleSubmit}
        disabled={loading || !token || !newPassword}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={authStyles.btnText}>Set new password</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.link}
        onPress={() => navigation.navigate('ForgotPassword')}
        disabled={loading}
      >
        <Text style={authStyles.linkText}>Didn't receive a code?</Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
}
