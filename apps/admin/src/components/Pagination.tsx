import { colors, css } from '../styles';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 20,
        justifyContent: 'flex-end',
      }}
    >
      <span style={{ fontSize: 13, color: colors.muted }}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
      </span>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        style={{ ...css.btnSecondary, opacity: page === 1 ? 0.4 : 1 }}
      >
        ← Anterior
      </button>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        style={{ ...css.btnSecondary, opacity: page >= totalPages ? 0.4 : 1 }}
      >
        Siguiente →
      </button>
    </div>
  );
}
