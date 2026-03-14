import { colors } from '../styles';

const STATUS_COLORS: Record<string, string> = {
  scheduled: colors.accent,
  locked: colors.warning,
  in_progress: colors.warning,
  played: colors.muted,
  canceled: colors.danger,
  confirmed: colors.success,
  invited: colors.accent,
  waitlist: colors.warning,
  declined: colors.danger,
  kicked: colors.danger,
  spectator: colors.muted,
  active: colors.success,
  banned: colors.danger,
  ADMIN: colors.warning,
  USER: colors.muted,
};

interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  const color = STATUS_COLORS[status] ?? colors.muted;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {status}
    </span>
  );
}
