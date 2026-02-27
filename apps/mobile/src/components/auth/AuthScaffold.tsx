import type { ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const logoLight = require('../../../../../docs/ui/templates/logo-light.png') as number;

interface Props {
  children: ReactNode;
  /** Large white text above the card (e.g. app name on Login). */
  title?: string;
  /** Show the logo image above the title. */
  showLogo?: boolean;
  /** Small label at the very top of the card (e.g. "INGRESA Y JUGÁ!"). */
  cardTitle?: string;
}

export function AuthScaffold({ children, title, showLogo = false, cardTitle }: Props) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {showLogo && (
              <Image source={logoLight} style={styles.logo} resizeMode="contain" />
            )}
            {title ? <Text style={styles.title}>{title}</Text> : null}

            <View style={styles.card}>
              {cardTitle ? <Text style={styles.cardTitle}>{cardTitle}</Text> : null}
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  logo: { width: 110, height: 110, marginBottom: 10 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 3,
    marginBottom: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    color: '#555',
    letterSpacing: 1.5,
    marginBottom: 18,
  },
});
