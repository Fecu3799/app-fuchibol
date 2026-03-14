import { colors, css } from '../styles';

interface Props {
  label: string;
  value: number | string;
  color?: string;
}

export function StatCard({ label, value, color }: Props) {
  return (
    <div style={css.card}>
      <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: color ?? colors.text }}>{value}</div>
    </div>
  );
}
