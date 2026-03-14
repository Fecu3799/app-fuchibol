import { colors } from '../styles';

interface Props {
  error: Error | null | unknown;
}

export function ErrorMsg({ error }: Props) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Error desconocido';
  return (
    <div
      style={{
        background: `${colors.danger}22`,
        border: `1px solid ${colors.danger}44`,
        borderRadius: 6,
        padding: '10px 14px',
        color: colors.danger,
        fontSize: 14,
        marginBottom: 16,
      }}
    >
      {message}
    </div>
  );
}
