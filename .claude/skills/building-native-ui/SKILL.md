---
name: building-native-ui
description: Guide for building UI in the fuchibol mobile app. Covers styling, navigation, components, and patterns specific to this repo (Expo + React Navigation, no Expo Router).
version: 1.1.0
---

# Mobile UI Guidelines — fuchibol

> Este repo usa **Expo SDK 54** + **React Navigation v7** (NO Expo Router).
> Stack: `react-native 0.81`, `react-query v5`, `expo-secure-store`, `socket.io-client`.

## Estructura de archivos

```
apps/mobile/src/
  screens/        → Una screen por archivo, export default
  components/     → Componentes reutilizables (NO co-locar en screens/)
  features/       → Hooks + clients agrupados por dominio (matches/, auth/, groups/)
  navigation/     → AppNavigator.tsx — único punto de verdad de rutas y param lists
  contexts/       → AuthContext (user, token, login, logout, refreshUser)
  lib/            → api.ts (fetchJson, interceptor), token-store.ts
  types/          → api.ts (DTOs de la API)
  config/         → env, constants
```

## Navegación

- **Router**: React Navigation. Nunca importar de `expo-router`.
- Toda ruta nueva requiere:
  1. Agregar al tipo `RootStackParamList` en `AppNavigator.tsx`
  2. Agregar el `<RootStack.Screen>` en `AppNavigator`
  3. Importar la screen en `AppNavigator`
- Navegar con el `navigation` prop tipado: `navigation.navigate('NombreRuta', params)`.
- Tabs viven en `TabParamList`. Screens modales/push en `RootStackParamList`.
- Para navegar desde una tab screen usar `CompositeScreenProps`.

```typescript
// Ejemplo: screen de tab que también puede navegar al stack root
type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'ProfileTab'>,
  NativeStackScreenProps<RootStackParamList>
>;
```

## Estilos

- Usar `StyleSheet.create` — es el estándar del repo. No usar inline styles salvo para valores dinámicos (colores condicionales, etc.).
- **Sin Tailwind, sin CSS**.
- Shadows: usar `boxShadow` (nueva API RN), NO `shadowColor/shadowOpacity/elevation`.
- Bordes redondeados con `borderCurve: 'continuous'` para esquinas suaves tipo iOS.
- Fuentes con `fontVariant: ['tabular-nums']` en contadores/números para alineación uniforme.
- Safe area: usar `react-native-safe-area-context`, NO el `SafeAreaView` de react-native.
- Para ScrollView/FlatList usar `contentInsetAdjustmentBehavior="automatic"` para safe area automática.
- Padding en contenedores scrolleables: usar `contentContainerStyle`, no el `style` raíz del ScrollView.
- Preferir `gap` flex en vez de margins repetidos.
- Dimensiones: `useWindowDimensions` hook, no `Dimensions.get()`.

## Componentes y primitivos

### Lo que hay hoy en el repo

- `AuthScaffold` — wrapper para screens de auth (scroll, padding, fondo)
- `AuthField` — input field con label, hint, toggle de contraseña
- `authStyles` + `AUTH_ACCENT` — estilos y color compartidos de auth
- `MatchBanner` — banner persistente de estado del match (canceled/reconfirm/promoted/reconnecting)

### Reglas generales

- **Sin toasts**. Feedback de estado via banners persistentes o texto de error inline.
- Errores se muestran como `<Text style={s.error}>` cerca del formulario o acción.
- Listas con `FlatList` cuando son largas/dinámicas; `map` cuando son cortas y estáticas.
- Botones con `TouchableOpacity` (activeOpacity 0.7-0.8) o `Pressable` para control más fino.
- Inputs con `TextInput` de react-native. Usar `autoCapitalize`, `autoCorrect`, `keyboardType` siempre.
- Para pickers de enums: pills (`TouchableOpacity` + `flexWrap`) — ver `RegisterScreen` / `EditProfileScreen`.
- Para fechas: `DateTimePicker` de `@react-native-community/datetimepicker` con lógica iOS/Android (iOS muestra "Listo", Android cierra solo).

### NO usar

- `Picker` de react-native (removido)
- `WebView`, `AsyncStorage` del core de RN
- `expo-av` → usar `expo-audio` / `expo-video`
- `expo-symbols` o `@expo/vector-icons` → si se necesitan iconos SF, usar `expo-image` con `source="sf:name"`
- `SafeAreaView` de react-native → usar `react-native-safe-area-context`
- `Platform.OS` para checks de OS en lógica de negocio → `Platform.OS` está bien para UI condicional

## Estado y datos

- **React Query** para todo server state. No duplicar en `useState` lo que viene de la API.
- `useAuth()` para acceder a `user`, `token`, `login`, `logout`, `refreshUser`.
- Después de mutaciones que cambian el perfil del usuario: llamar `refreshUser()` del contexto.
- Después de mutaciones que cambian un match: React Query invalida via `queryClient.invalidateQueries`.
- Estado local de UI (loading, error, form fields) en `useState` del componente.
- No Redux. No Context para server state.

## Patterns establecidos en el repo

### Screen de formulario

```typescript
export default function MiScreen({ navigation }: Props) {
  const [campo, setCampo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await llamadaApi(...);
      navigation.goBack(); // o navigate a otra screen
    } catch (err) {
      setError(err instanceof ApiError ? mapError(err) : 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.content}>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {/* campos */}
      <TouchableOpacity
        style={[s.btn, loading && s.btnDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Guardar</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
```

### PillRow para selectores de enum

```typescript
function PillRow<T extends string>({ options, selected, onSelect, disabled }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[s.pill, active && s.pillActive]}
            onPress={() => onSelect(active ? null : opt.value)}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Text style={[s.pillText, active && s.pillTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
```

### Error de API

```typescript
import { ApiError } from '../lib/api';

catch (err) {
  if (err instanceof ApiError) {
    // err.status, err.body.message, err.body.detail, err.body.code
  }
}
```

## Idioma y copy

- UI en **español** (Argentina). Labels, placeholders, mensajes de error — todo en español.
- Excepciones: nombres técnicos (status badges como "CONFIRMED", logs de dev).

## Running

- Desarrollo: `npx expo start` → Expo Go en iPhone físico (target principal).
- Push notifications y algunas APIs nativas requieren dispositivo físico, no simulador.
- Web (`expo start --web`) solo para debug rápido — algunas APIs no están disponibles.
- Si se agregan módulos nativos no incluidos en Expo Go → `npx expo run:ios`.
