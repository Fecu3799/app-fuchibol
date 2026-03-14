import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';
import { AuthScaffold } from '../components/auth/AuthScaffold';
import { AuthField } from '../components/auth/AuthField';
import { authStyles } from '../components/auth/authStyles';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation, route }: Props) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState(route.params?.prefillEmail ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'account_suspended') {
          const until = err.body.suspendedUntil
            ? new Date(err.body.suspendedUntil).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'fecha desconocida';
          setError(`Tu cuenta está suspendida hasta ${until}.`);
          return;
        }
        if (err.code === 'EMAIL_NOT_VERIFIED' || err.status === 403) {
          navigation.navigate('VerifyEmail', {
            email: identifier.trim().includes('@') ? identifier.trim() : undefined,
          });
          return;
        }
        setError(err.body.detail ?? err.body.message ?? 'Login failed');
      } else if (err instanceof Error && err.message === 'ADMIN_ROLE') {
        setError('Esta cuenta es de administrador. Ingresá desde el panel de administración.');
      } else {
        setError('Connection error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && !!identifier && !!password;

  return (
    <AuthScaffold showLogo title="FUCHIBOL" cardTitle="INGRESA Y JUGÁ!">
      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <AuthField
        placeholder="Cuenta…"
        autoCapitalize="none"
        autoCorrect={false}
        value={identifier}
        onChangeText={setIdentifier}
        editable={!loading}
      />
      <AuthField
        placeholder="Contraseña…"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <TouchableOpacity
        onPress={() => navigation.navigate('ForgotPassword')}
        disabled={loading}
        style={styles.forgotLink}
      >
        <Text style={styles.forgotText}>¿No recordás tu contraseña?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[authStyles.btnOutline, !canSubmit && authStyles.btnDisabled]}
        onPress={handleLogin}
        disabled={!canSubmit}
        activeOpacity={0.75}
      >
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={authStyles.btnOutlineText}>INGRESAR</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.noAccountLabel}>¿No tenés cuenta?</Text>

      <TouchableOpacity
        style={authStyles.btnOutline}
        onPress={() => navigation.navigate('Register')}
        disabled={loading}
        activeOpacity={0.75}
      >
        <Text style={authStyles.btnOutlineText}>REGISTRARSE</Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  forgotLink: { alignSelf: 'flex-end', marginBottom: 18 },
  forgotText: { color: '#1976d2', fontSize: 12 },
  noAccountLabel: { textAlign: 'center', fontSize: 12, color: '#888', marginTop: 8, marginBottom: 4 },
});
