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
import type { RootStackParamList } from '../navigation/AppNavigator';
import { postPasswordChange } from '../features/auth/authClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;

export default function ChangePasswordScreen({ navigation }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = (): string => {
    if (!currentPassword) return 'Enter your current password.';
    if (!PASSWORD_RE.test(newPassword))
      return 'New password must be at least 8 characters with 1 uppercase letter and 1 number.';
    if (newPassword !== confirmPassword) return 'Passwords do not match.';
    return '';
  };

  const handleSubmit = async () => {
    const msg = validate();
    if (msg) { setError(msg); return; }
    setError('');
    setLoading(true);
    try {
      await postPasswordChange(currentPassword, newPassword);
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Current password is incorrect.');
      } else {
        setError('Something went wrong. Please try again.');
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
      <View style={styles.form}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Current password"
            secureTextEntry={!showCurrent}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            editable={!loading}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent(v => !v)}>
            <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={22} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            placeholder="New password"
            secureTextEntry={!showNew}
            value={newPassword}
            onChangeText={setNewPassword}
            editable={!loading}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(v => !v)}>
            <Ionicons name={showNew ? 'eye-off' : 'eye'} size={22} color="#666" />
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!loading}
        />

        <Text style={styles.hint}>
          Min. 8 characters · 1 uppercase · 1 number
        </Text>

        <TouchableOpacity
          style={[styles.button, (loading || !currentPassword || !newPassword || !confirmPassword) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !currentPassword || !newPassword || !confirmPassword}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Update password</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center' },
  form: { paddingHorizontal: 32 },
  error: { color: '#d32f2f', textAlign: 'center', marginBottom: 16 },
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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  hint: { fontSize: 12, color: '#999', marginBottom: 16 },
  button: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
