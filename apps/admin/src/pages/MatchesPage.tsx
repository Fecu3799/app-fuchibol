import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listMatches } from '../api/matches';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { ErrorMsg } from '../components/ErrorMsg';
import { colors, css } from '../styles';

export function MatchesPage() {
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, error, isLoading } = useQuery({
    queryKey: ['matches', status, dateFrom, dateTo, page],
    queryFn: () => listMatches({ status, dateFrom, dateTo, page, pageSize }),
  });

  return (
    <div style={{ padding: '32px 36px' }}>
      <PageHeader title="Partidos" subtitle={data ? `${data.pageInfo.total} partidos` : undefined} />

      <ErrorMsg error={error} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          style={{ ...css.input, width: 160 }}
        >
          <option value="">Todos los estados</option>
          <option value="scheduled">scheduled</option>
          <option value="locked">locked</option>
          <option value="in_progress">in_progress</option>
          <option value="played">played</option>
          <option value="canceled">canceled</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          style={{ ...css.input, width: 160 }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          style={{ ...css.input, width: 160 }}
        />
        {(status || dateFrom || dateTo) && (
          <button
            onClick={() => { setStatus(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            style={css.btnSecondary}
          >
            Limpiar
          </button>
        )}
      </div>

      {isLoading && <p style={{ color: colors.muted }}>Cargando...</p>}

      {data && (
        <>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={css.table}>
              <thead>
                <tr>
                  <th style={css.th}>Título</th>
                  <th style={css.th}>Estado</th>
                  <th style={css.th}>Fecha</th>
                  <th style={css.th}>Organizador</th>
                  <th style={css.th}>Venue</th>
                  <th style={css.th}>Cupo</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((match) => (
                  <tr key={match.id}>
                    <td style={css.td}>
                      <Link
                        to={`/matches/${match.id}`}
                        style={{ color: colors.accent, textDecoration: 'none', fontWeight: 500 }}
                      >
                        {match.title}
                      </Link>
                    </td>
                    <td style={css.td}><StatusBadge status={match.status} /></td>
                    <td style={{ ...css.td, color: colors.muted, fontSize: 13 }}>
                      {new Date(match.startsAt).toLocaleString('es-AR')}
                    </td>
                    <td style={{ ...css.td, color: colors.muted }}>{match.creatorUsername}</td>
                    <td style={{ ...css.td, color: colors.muted }}>{match.venueName ?? '—'}</td>
                    <td style={{ ...css.td, color: colors.muted }}>
                      {match.confirmedCount}/{match.capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={data.pageInfo.total}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
