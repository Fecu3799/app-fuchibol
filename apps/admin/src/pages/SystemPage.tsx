import { useQuery } from '@tanstack/react-query';
import { getSystemHealth } from '../api/system';
import { PageHeader } from '../components/PageHeader';
import { ErrorMsg } from '../components/ErrorMsg';
import { colors, css } from '../styles';

export function SystemPage() {
  const { data, error, isLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: 30_000,
  });

  function statusColor(ok: boolean) {
    return ok ? colors.success : colors.danger;
  }

  function dot(ok: boolean) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: statusColor(ok),
          marginRight: 8,
        }}
      />
    );
  }

  return (
    <div style={{ padding: '32px 36px' }}>
      <PageHeader
        title="Sistema"
        subtitle={
          dataUpdatedAt
            ? `Actualizado: ${new Date(dataUpdatedAt).toLocaleTimeString('es-AR')}`
            : undefined
        }
        action={
          <button onClick={() => void refetch()} style={css.btnSecondary}>
            Actualizar
          </button>
        }
      />

      <ErrorMsg error={error} />
      {isLoading && <p style={{ color: colors.muted }}>Cargando...</p>}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {/* DB */}
          <div style={css.card}>
            <div
              style={{
                fontSize: 12,
                color: colors.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 12,
              }}
            >
              Base de datos
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: statusColor(data.db.status === 'ok'),
              }}
            >
              {dot(data.db.status === 'ok')}
              {data.db.status === 'ok' ? 'OK' : 'ERROR'}
            </div>
          </div>

          {/* Cron */}
          <div style={css.card}>
            <div
              style={{
                fontSize: 12,
                color: colors.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 12,
              }}
            >
              Cron / Lifecycle job
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: statusColor(data.cron.status === 'ok'),
                marginBottom: 8,
              }}
            >
              {dot(data.cron.status === 'ok')}
              {data.cron.status}
            </div>
            {data.cron.lastTickAt && (
              <div style={{ fontSize: 13, color: colors.muted }}>
                Último tick:{' '}
                <span style={{ color: data.cron.status === 'ok' ? colors.success : colors.danger }}>
                  {new Date(data.cron.lastTickAt).toLocaleTimeString('es-AR')}
                </span>
              </div>
            )}
            {!data.cron.lastTickAt && (
              <div style={{ fontSize: 13, color: colors.muted }}>Sin registro de tick</div>
            )}
          </div>

          {/* Notifications */}
          <div style={css.card}>
            <div
              style={{
                fontSize: 12,
                color: colors.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 12,
              }}
            >
              Notificaciones (última hora)
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: colors.text, marginBottom: 4 }}>
              {data.notifications.deliveredL1h}
            </div>
            <div style={{ fontSize: 13, color: colors.muted }}>
              enviadas ·{' '}
              <span
                style={{
                  color:
                    data.notifications.disabledDevices > 0 ? colors.warning : colors.muted,
                }}
              >
                {data.notifications.disabledDevices} dispositivos deshabilitados
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
