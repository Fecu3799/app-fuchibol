import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../api/auth';
import { colors, css } from '../styles';

interface Props {
  onLogin: (token: string) => void;
}

export function LoginPage({ onLogin }: Props) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginAdmin(identifier, password);
      onLogin(res.accessToken);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: '40px 36px',
          width: 360,
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: colors.text }}>
          ⚽ Fuchibol Admin
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: colors.muted }}>
          Ingresá con tu cuenta de administrador
        </p>

        {error && (
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
            {error}
          </div>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: colors.muted, marginBottom: 6 }}>
              Email o usuario
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              style={css.input}
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: colors.muted, marginBottom: 6 }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={css.input}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...css.btnPrimary, width: '100%', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Iniciando sesión...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
