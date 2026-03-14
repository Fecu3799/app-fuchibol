import { colors } from '../styles';

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: colors.text }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 14, color: colors.muted }}>{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
