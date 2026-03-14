import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listUsers } from '../api/users';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { ErrorMsg } from '../components/ErrorMsg';
import { colors, css } from '../styles';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, error, isLoading } = useQuery({
    queryKey: ['users', search, status, page],
    queryFn: () => listUsers({ search, status, page, pageSize }),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <div style={{ padding: '32px 36px' }}>
      <PageHeader title="Usuarios" subtitle={data ? `${data.pageInfo.total} usuarios en total` : undefined} />

      <ErrorMsg error={error} />

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Buscar por username o email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ ...css.input, width: 320 }}
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          style={{ ...css.input, width: 160 }}
        >
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="banned">Baneados</option>
        </select>
      </form>

      {isLoading && <p style={{ color: colors.muted }}>Cargando...</p>}

      {data && (
        <>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={css.table}>
              <thead>
                <tr>
                  <th style={css.th}>Usuario</th>
                  <th style={css.th}>Email</th>
                  <th style={css.th}>Rol</th>
                  <th style={css.th}>Estado</th>
                  <th style={css.th}>Partidos</th>
                  <th style={css.th}>Push tokens</th>
                  <th style={css.th}>Creado</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.id} style={{ cursor: 'pointer' }}>
                    <td style={css.td}>
                      <Link
                        to={`/users/${user.id}`}
                        style={{ color: colors.accent, textDecoration: 'none', fontWeight: 500 }}
                      >
                        {user.username}
                      </Link>
                    </td>
                    <td style={{ ...css.td, color: colors.muted }}>{user.email}</td>
                    <td style={css.td}>
                      <StatusBadge status={user.role} />
                    </td>
                    <td style={css.td}>
                      <StatusBadge status={user.bannedAt ? 'banned' : 'active'} />
                    </td>
                    <td style={{ ...css.td, color: colors.muted }}>{user.matchCount}</td>
                    <td style={{ ...css.td, color: colors.muted }}>{user.pushTokenCount}</td>
                    <td style={{ ...css.td, color: colors.muted, fontSize: 12 }}>
                      {new Date(user.createdAt).toLocaleDateString('es-AR')}
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
