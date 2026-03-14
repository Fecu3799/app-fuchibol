export const colors = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceHover: '#263347',
  border: '#334155',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#38bdf8',
  accentDark: '#0284c7',
  success: '#4ade80',
  warning: '#fb923c',
  danger: '#f87171',
  dangerDark: '#dc2626',
} as const;

export const sidebar = {
  width: 220,
};

export const css = {
  card: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: '20px 24px',
  } satisfies React.CSSProperties,

  input: {
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    color: colors.text,
    padding: '8px 12px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  } satisfies React.CSSProperties,

  btnPrimary: {
    background: colors.accent,
    color: '#0f172a',
    border: 'none',
    borderRadius: 6,
    padding: '10px 20px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  } satisfies React.CSSProperties,

  btnDanger: {
    background: colors.danger,
    color: '#0f172a',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  } satisfies React.CSSProperties,

  btnSecondary: {
    background: 'transparent',
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 13,
    cursor: 'pointer',
  } satisfies React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 14,
  },

  th: {
    textAlign: 'left' as const,
    padding: '10px 12px',
    color: colors.muted,
    fontWeight: 500,
    borderBottom: `1px solid ${colors.border}`,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },

  td: {
    padding: '12px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.text,
    verticalAlign: 'middle' as const,
  },
} as const;
