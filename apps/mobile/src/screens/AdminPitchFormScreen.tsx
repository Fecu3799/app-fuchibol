import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../navigation/AppNavigator';
import type { PitchType } from '../types/api';
import {
  listPitchesAdmin,
  createPitchAdmin,
  updatePitchAdmin,
} from '../features/admin/adminClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminPitchForm'>;

const PITCH_TYPES: PitchType[] = ['F5', 'F7', 'F9', 'F11'];

export default function AdminPitchFormScreen({ route, navigation }: Props) {
  const { venueId, pitchId } = route.params;
  const isEdit = !!pitchId;

  const [name, setName] = useState('');
  const [pitchType, setPitchType] = useState<PitchType>('F5');
  const [price, setPrice] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    void (async () => {
      try {
        const res = await listPitchesAdmin(venueId);
        const pitch = res.items.find((p) => p.id === pitchId);
        if (!pitch) { setError('Cancha no encontrada.'); return; }
        setName(pitch.name);
        setPitchType(pitch.pitchType as PitchType);
        setPrice(pitch.price != null ? String(pitch.price) : '');
        setIsActive(pitch.isActive);
      } catch {
        setError('No se pudo cargar la cancha.');
      } finally {
        setLoading(false);
      }
    })();
  }, [venueId, pitchId, isEdit]);

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
    setError('');
    setSaving(true);
    try {
      const parsedPrice = price.trim() ? parseFloat(price) : undefined;

      if (isEdit && pitchId) {
        await updatePitchAdmin(venueId, pitchId, {
          name: name.trim(),
          pitchType,
          ...(parsedPrice != null && !isNaN(parsedPrice) ? { price: parsedPrice } : {}),
          isActive,
        });
      } else {
        await createPitchAdmin(venueId, {
          name: name.trim(),
          pitchType,
          ...(parsedPrice != null && !isNaN(parsedPrice) ? { price: parsedPrice } : {}),
        });
      }
      navigation.goBack();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? (err.body.detail ?? err.body.message ?? 'Error al guardar.')
          : 'Error de conexión.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={s.error}>{error}</Text> : null}

        <Text style={s.label}>Nombre *</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Ej: Cancha A"
          autoCapitalize="words"
          autoCorrect={false}
          editable={!saving}
        />

        <Text style={s.label}>Tipo de cancha *</Text>
        <View style={s.pillRow}>
          {PITCH_TYPES.map((t) => (
            <Pressable
              key={t}
              style={[s.pill, pitchType === t && s.pillActive]}
              onPress={() => setPitchType(t)}
              disabled={saving}
            >
              <Text style={[s.pillText, pitchType === t && s.pillTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Precio por partido</Text>
        <TextInput
          style={s.input}
          value={price}
          onChangeText={setPrice}
          placeholder="Ej: 5000"
          keyboardType="decimal-pad"
          editable={!saving}
        />

        {isEdit && (
          <View style={s.switchRow}>
            <Text style={s.label}>Cancha activa</Text>
            <Switch value={isActive} onValueChange={setIsActive} disabled={saving} />
          </View>
        )}

        <Pressable
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveBtnText}>{isEdit ? 'Guardar cambios' : 'Crear cancha'}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  error: { color: '#d32f2f', marginBottom: 12, textAlign: 'center' },

  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 11,
    fontSize: 15,
    color: '#111',
  },

  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pillActive: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  pillText: { fontSize: 14, fontWeight: '700', color: '#555' },
  pillTextActive: { color: '#fff' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingVertical: 4,
  },

  saveBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
