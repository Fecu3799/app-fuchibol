import { StyleSheet } from 'react-native';

export const AUTH_ACCENT = '#1976d2';

export const authStyles = StyleSheet.create({
  // ── Inputs ──
  input: {
    borderWidth: 1,
    borderColor: '#d5d5d5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#fafafa',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 4,
  },
  hint: {
    fontSize: 11,
    color: '#999',
    marginTop: -6,
    marginBottom: 10,
  },

  // ── Primary filled button ──
  btn: {
    backgroundColor: AUTH_ACCENT,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ── Outlined dark button (Login-style CTAs) ──
  btnOutline: {
    borderWidth: 1.5,
    borderColor: '#222',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  btnOutlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    letterSpacing: 1.5,
  },

  // ── Outlined accent button (secondary action) ──
  btnSecondary: {
    borderWidth: 1,
    borderColor: AUTH_ACCENT,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  btnSecondaryText: {
    color: AUTH_ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },

  btnDisabled: { opacity: 0.45 },

  // ── Text links ──
  link: { alignItems: 'center', marginTop: 14 },
  linkText: { color: AUTH_ACCENT, fontSize: 13 },

  // ── Feedback messages ──
  error: { color: '#d32f2f', textAlign: 'center', marginBottom: 10, fontSize: 13 },
  successText: { color: '#388e3c', textAlign: 'center', marginBottom: 10, fontSize: 13 },

  // ── Card secondary text ──
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },

  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
});
