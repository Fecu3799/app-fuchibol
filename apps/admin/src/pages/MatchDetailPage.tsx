import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMatch, cancelMatch, deleteMatch, unlockMatch } from '../api/matches';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorMsg } from '../components/ErrorMsg';
import { colors, css } from '../styles';

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: match, error, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: () => getMatch(id!),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelMatch(id!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['match', id] }),
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockMatch(id!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['match', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMatch(id!),
    onSuccess: () => { window.location.href = '/matches'; },
  });

  const isActive = match && !['played', 'canceled'].includes(match.status);

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/matches" style={{ color: colors.muted, textDecoration: 'none', fontSize: 14 }}>
          ← Volver a partidos
        </Link>
      </div>

      <ErrorMsg error={error} />

      {isLoading && <p style={{ color: colors.muted }}>Cargando...</p>}

      {match && (
        <>
          <PageHeader
            title={match.title}
            subtitle={`${match.venueName ?? 'Sin venue'} · ${new Date(match.startsAt).toLocaleString('es-AR')}`}
            action={
              <div style={{ display: 'flex', gap: 8 }}>
                {match.status === 'locked' && (
                  <button
                    onClick={() => unlockMutation.mutate()}
                    disabled={unlockMutation.isPending}
                    style={css.btnSecondary}
                  >
                    {unlockMutation.isPending ? '...' : 'Desbloquear'}
                  </button>
                )}
                {isActive && (
                  <button
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    style={css.btnDanger}
                  >
                    {cancelMutation.isPending ? '...' : 'Cancelar partido'}
                  </button>
                )}
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ ...css.btnDanger, background: colors.dangerDark }}
                >
                  Eliminar
                </button>
              </div>
            }
          />

          <ErrorMsg error={cancelMutation.error} />
          <ErrorMsg error={unlockMutation.error} />
          <ErrorMsg error={deleteMutation.error} />

          {confirmDelete && (
            <div style={{ ...css.card, marginBottom: 24, borderColor: colors.danger + '44', background: colors.danger + '11' }}>
              <p style={{ margin: '0 0 12px', color: colors.danger, fontWeight: 600 }}>
                ¿Eliminás el partido permanentemente? Esta acción no se puede deshacer.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  style={{ ...css.btnDanger, background: colors.dangerDark }}
                >
                  {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
                <button onClick={() => setConfirmDelete(false)} style={css.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={css.card}>
              <SectionTitle>Detalles</SectionTitle>
              <Row label="Estado" value={<StatusBadge status={match.status} />} />
              <Row label="Organizador" value={match.creatorUsername} />
              <Row label="Pitch" value={match.pitchType ?? '—'} />
              <Row label="Capacity" value={`${match.participants.filter(p => p.status === 'confirmed').length}/${match.capacity}`} />
              <Row label="Revision" value={String(match.revision)} />
              <Row label="ID" value={match.id} mono />
            </div>

            <div style={css.card}>
              <SectionTitle>
                Participantes ({match.participants.filter(p => p.status === 'confirmed').length} confirmados)
              </SectionTitle>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {match.participants.map((p) => (
                  <div key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                    <span>
                      <Link to={`/users/${p.userId}`} style={{ color: colors.accent, textDecoration: 'none' }}>
                        {p.username}
                      </Link>
                      {p.isMatchAdmin && <span style={{ marginLeft: 4, fontSize: 11, color: colors.warning }}>admin</span>}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...css.card, marginBottom: 24 }}>
            <SectionTitle>Audit log ({match.auditLogs.length})</SectionTitle>
            {match.auditLogs.length === 0 ? (
              <p style={{ color: colors.muted, fontSize: 14, margin: 0 }}>Sin registros</p>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {match.auditLogs.map((log) => (
                  <div key={log.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ color: colors.accent, fontWeight: 500 }}>{log.type}</span>
                      <span style={{ color: colors.muted, fontSize: 12 }}>{new Date(log.createdAt).toLocaleString('es-AR')}</span>
                    </div>
                    {log.actorId && <div style={{ color: colors.muted, fontSize: 12 }}>actor: {log.actorId}</div>}
                    {Object.keys(log.metadata).length > 0 && (
                      <pre style={{ margin: '4px 0 0', fontSize: 11, color: colors.muted, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={css.card}>
            <SectionTitle>Notification deliveries ({match.notificationDeliveries.length})</SectionTitle>
            {match.notificationDeliveries.length === 0 ? (
              <p style={{ color: colors.muted, fontSize: 14, margin: 0 }}>Sin notificaciones enviadas</p>
            ) : (
              <table style={css.table}>
                <thead>
                  <tr>
                    <th style={css.th}>Tipo</th>
                    <th style={css.th}>Usuario</th>
                    <th style={css.th}>Bucket</th>
                    <th style={css.th}>Enviado</th>
                  </tr>
                </thead>
                <tbody>
                  {match.notificationDeliveries.map((d) => (
                    <tr key={d.id}>
                      <td style={{ ...css.td, color: colors.accent, fontSize: 12 }}>{d.type}</td>
                      <td style={css.td}>
                        <Link to={`/users/${d.userId}`} style={{ color: colors.text, textDecoration: 'none', fontSize: 12 }}>
                          {d.userId.slice(0, 8)}...
                        </Link>
                      </td>
                      <td style={{ ...css.td, color: colors.muted, fontSize: 12 }}>{d.bucket ?? '—'}</td>
                      <td style={{ ...css.td, color: colors.muted, fontSize: 12 }}>
                        {new Date(d.createdAt).toLocaleString('es-AR')}
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ margin: '0 0 16px', fontSize: 14, color: colors.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </h3>
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
