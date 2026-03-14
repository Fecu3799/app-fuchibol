import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { colors, sidebar } from "../styles";
import { clearToken } from "../auth/useAuth";

const navItems = [
  { to: "/", label: "Dashboard", exact: true },
  { to: "/users", label: "Usuarios" },
  { to: "/matches", label: "Partidos" },
  { to: "/venues", label: "Predios y Canchas" },
  { to: "/system", label: "Sistema" },
];

export function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: colors.bg,
        color: colors.text,
      }}
    >
      <aside
        style={{
          width: sidebar.width,
          minWidth: sidebar.width,
          background: colors.surface,
          borderRight: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
          padding: "0",
        }}
      >
        <div
          style={{
            padding: "24px 20px 20px",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 18, color: colors.accent }}>
            ⚽ Fuchibol
          </span>
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
            Admin Panel
          </div>
        </div>

        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {navItems.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                display: "block",
                padding: "9px 12px",
                borderRadius: 6,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? colors.accent : colors.text,
                background: isActive ? "rgba(56,189,248,0.1)" : "transparent",
                marginBottom: 2,
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div
          style={{ padding: "16px", borderTop: `1px solid ${colors.border}` }}
        >
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              background: "transparent",
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              color: colors.muted,
              padding: "8px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
