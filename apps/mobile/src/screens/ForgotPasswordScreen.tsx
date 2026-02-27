import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { postPasswordResetRequest } from '../features/auth/authClient';
import { AuthScaffold } from '../components/auth/AuthScaffold';
import { AuthField } from '../components/auth/AuthField';
import { authStyles } from '../components/auth/authStyles';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await postPasswordResetRequest(email.trim().toLowerCase());
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthScaffold>
        <Text style={authStyles.cardSubtitle}>
          ✓ If an account exists for {email.trim()}, you'll receive a reset link shortly.
        </Text>
        <TouchableOpacity
          style={authStyles.btn}
          onPress={() => navigation.navigate('ResetPassword')}
          activeOpacity={0.8}
        >
          <Text style={authStyles.btnText}>Enter reset code</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={authStyles.link}
          onPress={() => navigation.navigate('Login', {})}
        >
          <Text style={authStyles.linkText}>Back to login</Text>
        </TouchableOpacity>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold>
      <Text style={authStyles.cardSubtitle}>
        Enter your email and we'll send you a link to reset your password.
      </Text>

      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <AuthField
        placeholder="Email address"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <TouchableOpacity
        style={[authStyles.btn, (loading || !email) && authStyles.btnDisabled]}
        onPress={handleSubmit}
        disabled={loading || !email}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={authStyles.btnText}>Send reset link</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.link}
        onPress={() => navigation.goBack()}
        disabled={loading}
      >
        <Text style={authStyles.linkText}>Back to login</Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
}
