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
import { listVenuesAdmin, createVenueAdmin, updateVenueAdmin } from '../features/admin/adminClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminVenueForm'>;

export default function AdminVenueFormScreen({ route, navigation }: Props) {
  const { venueId } = route.params ?? {};
  const isEdit = !!venueId;

  const [name, setName] = useState('');
  const [addressText, setAddressText] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    void (async () => {
      try {
        const res = await listVenuesAdmin();
        const venue = res.items.find((v) => v.id === venueId);
        if (!venue) { setError('Predio no encontrado.'); return; }
        setName(venue.name);
        setAddressText(venue.addressText ?? '');
        setMapsUrl(venue.mapsUrl ?? '');
        setLatitude(venue.latitude != null ? String(venue.latitude) : '');
        setLongitude(venue.longitude != null ? String(venue.longitude) : '');
        setIsActive(venue.isActive);
      } catch {
        setError('No se pudo cargar el predio.');
      } finally {
        setLoading(false);
      }
    })();
  }, [venueId, isEdit]);

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
    setError('');
    setSaving(true);
    try {
      const lat = latitude.trim() ? parseFloat(latitude) : undefined;
      const lng = longitude.trim() ? parseFloat(longitude) : undefined;

      const data = {
        name: name.trim(),
        addressText: addressText.trim() || undefined,
        mapsUrl: mapsUrl.trim() || undefined,
        ...(lat != null && !isNaN(lat) ? { latitude: lat } : {}),
        ...(lng != null && !isNaN(lng) ? { longitude: lng } : {}),
      };

      if (isEdit && venueId) {
        await updateVenueAdmin(venueId, { ...data, isActive });
      } else {
        await createVenueAdmin(data);
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
          placeholder="Ej: Predio Norte"
          autoCapitalize="words"
          autoCorrect={false}
          editable={!saving}
        />

        <Text style={s.label}>Dirección</Text>
        <TextInput
          style={s.input}
          value={addressText}
          onChangeText={setAddressText}
          placeholder="Av. Siempre Viva 742"
          autoCapitalize="words"
          autoCorrect={false}
          editable={!saving}
        />

        <Text style={s.label}>URL del mapa</Text>
        <TextInput
          style={s.input}
          value={mapsUrl}
          onChangeText={setMapsUrl}
          placeholder="https://maps.google.com/..."
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!saving}
        />

        <View style={s.row}>
          <View style={s.half}>
            <Text style={s.label}>Latitud</Text>
            <TextInput
              style={s.input}
              value={latitude}
              onChangeText={setLatitude}
              placeholder="-34.603"
              keyboardType="decimal-pad"
              editable={!saving}
            />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Longitud</Text>
            <TextInput
              style={s.input}
              value={longitude}
              onChangeText={setLongitude}
              placeholder="-58.381"
              keyboardType="decimal-pad"
              editable={!saving}
            />
          </View>
        </View>

        {isEdit && (
          <View style={s.switchRow}>
            <Text style={s.label}>Predio activo</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              disabled={saving}
            />
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
            <Text style={s.saveBtnText}>{isEdit ? 'Guardar cambios' : 'Crear predio'}</Text>
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

  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },

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
