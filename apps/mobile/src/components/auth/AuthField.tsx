import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authStyles } from './authStyles';

interface Props extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  /** Renders an eye-toggle instead of a plain secure input. */
  secureToggle?: boolean;
}

export function AuthField({ label, hint, secureToggle, ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  const labelEl = label ? <Text style={authStyles.label}>{label}</Text> : null;
  const hintEl = hint ? <Text style={authStyles.hint}>{hint}</Text> : null;

  if (secureToggle) {
    return (
      <View>
        {labelEl}
        <View style={styles.row}>
          <TextInput
            style={styles.inputFlex}
            placeholderTextColor="#aaa"
            secureTextEntry={!visible}
            {...rest}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setVisible(v => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={visible ? 'eye-off' : 'eye'} size={22} color="#999" />
          </TouchableOpacity>
        </View>
        {hintEl}
      </View>
    );
  }

  return (
    <View>
      {labelEl}
      <TextInput
        style={authStyles.input}
        placeholderTextColor="#aaa"
        {...rest}
      />
      {hintEl}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d5d5d5',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: 10,
  },
  inputFlex: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
  },
  eyeBtn: { paddingHorizontal: 12 },
});
