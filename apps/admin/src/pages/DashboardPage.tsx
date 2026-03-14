import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../api/dashboard';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { ErrorMsg } from '../components/ErrorMsg';
import { colors } from '../styles';

export function DashboardPage() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60_000,
  });

  return (
    <div style={{ padding: '32px 36px' }}>
      <PageHeader title="Dashboard" subtitle="Vista general del sistema" />

      <ErrorMsg error={error} />

      {isLoading && <p style={{ color: colors.muted }}>Cargando...</p>}

      {data && (
        <>
          <h2 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Usuarios
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            <StatCard label="Total" value={data.users.total} />
            <StatCard label="Activos (7d)" value={data.users.activeLast7d} color={colors.success} />
            <StatCard label="Baneados" value={data.users.banned} color={data.users.banned > 0 ? colors.danger : undefined} />
          </div>

          <h2 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Partidos
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            <StatCard label="Hoy" value={data.matches.today} color={colors.accent} />
            <StatCard label="Mañana" value={data.matches.tomorrow} />
            <StatCard label="Programados" value={data.matches.scheduled} />
          </div>

          <h2 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Notificaciones
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <StatCard label="Enviadas (24h)" value={data.notifications.sentLast24h} />
          </div>
        </>
      )}
    </div>
  );
}
