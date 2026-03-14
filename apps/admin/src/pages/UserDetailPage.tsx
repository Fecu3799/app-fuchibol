import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUser, banUser, unbanUser } from '../api/users';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorMsg } from '../components/ErrorMsg';
import { colors, css } from '../styles';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [banReason, setBanReason] = useState('');
  const [showBanForm, setShowBanForm] = useState(false);

  const { data: user, error, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => getUser(id!),
    enabled: !!id,
  });

  const banMutation = useMutation({
    mutationFn: () => banUser(id!, banReason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user', id] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowBanForm(false);
      setBanReason('');
    },
  });

  const unbanMutation = useMutation({
    mutationFn: () => unbanUser(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user', id] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/users" style={{ color: colors.muted, textDecoration: 'none', fontSize: 14 }}>
          ← Volver a usuarios
        </Link>
      </div>

      <ErrorMsg error={error} />

      {isLoading && <p style={{ color: colors.muted }}>Cargando...</p>}

      {user && (
        <>
          <PageHeader
            title={user.username}
            subtitle={user.email}
            action={
              user.bannedAt ? (
                <button
                  onClick={() => unbanMutation.mutate()}
                  disabled={unbanMutation.isPending}
                  style={css.btnSecondary}
                >
                  {unbanMutation.isPending ? 'Desbaneando...' : 'Desbanear'}
                </button>
              ) : (
                <button
                  onClick={() => setShowBanForm(!showBanForm)}
                  style={css.btnDanger}
                >
                  Banear usuario
                </button>
              )
            }
          />

          <ErrorMsg error={banMutation.error} />
          <ErrorMsg error={unbanMutation.error} />

          {showBanForm && (
            <div style={{ ...css.card, marginBottom: 24, borderColor: colors.danger + '44' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, color: colors.danger }}>Banear usuario</h3>
              <input
                type="text"
                placeholder="Motivo del baneo (requerido)"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                style={{ ...css.input, marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => banMutation.mutate()}
                  disabled={!banReason.trim() || banMutation.isPending}
                  style={{ ...css.btnDanger, opacity: !banReason.trim() ? 0.5 : 1 }}
                >
                  {banMutation.isPending ? 'Baneando...' : 'Confirmar baneo'}
                </button>
                <button onClick={() => setShowBanForm(false)} style={css.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {user.bannedAt && (
            <div style={{ ...css.card, marginBottom: 24, borderColor: colors.danger + '44', background: colors.danger + '11' }}>
              <strong style={{ color: colors.danger }}>Usuario baneado</strong>
              <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 14 }}>
                Desde: {new Date(user.bannedAt).toLocaleString('es-AR')}
                {user.banReason && ` · Motivo: ${user.banReason}`}
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={css.card}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, color: colors.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Información
              </h3>
              <Row label="ID" value={user.id} mono />
              <Row label="Rol" value={<StatusBadge status={user.role} />} />
              <Row label="Estado" value={<StatusBadge status={user.bannedAt ? 'banned' : 'active'} />} />
              <Row label="Creado" value={new Date(user.createdAt).toLocaleString('es-AR')} />
              <Row label="Último login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('es-AR') : '—'} />
              <Row label="Partidos" value={String(user.matchCount)} />
            </div>

            <div style={css.card}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, color: colors.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Push tokens ({user.pushTokens.length})
              </h3>
              {user.pushTokens.length === 0 ? (
                <p style={{ color: colors.muted, fontSize: 14, margin: 0 }}>Sin tokens registrados</p>
              ) : (
                user.pushTokens.map((t, i) => (
                  <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < user.pushTokens.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: colors.accent, wordBreak: 'break-all' }}>{t.token}</div>
                    <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{t.platform} · {new Date(t.createdAt).toLocaleDateString('es-AR')}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={css.card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, color: colors.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Partidos recientes
            </h3>
            {user.recentMatches.length === 0 ? (
              <p style={{ color: colors.muted, fontSize: 14, margin: 0 }}>Sin partidos</p>
            ) : (
              <table style={css.table}>
                <thead>
                  <tr>
                    <th style={css.th}>Título</th>
                    <th style={css.th}>Estado</th>
                    <th style={css.th}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {user.recentMatches.map((m) => (
                    <tr key={m.id}>
                      <td style={css.td}>
                        <Link to={`/matches/${m.id}`} style={{ color: colors.accent, textDecoration: 'none' }}>
                          {m.title}
                        </Link>
                      </td>
                      <td style={css.td}><StatusBadge status={m.status} /></td>
                      <td style={{ ...css.td, color: colors.muted, fontSize: 13 }}>
                        {new Date(m.startsAt).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 14 }}>
      <span style={{ color: colors.muted }}>{label}</span>
      <span style={{ color: colors.text, fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 11 : 14 }}>{value}</span>
    </div>
  );
}
