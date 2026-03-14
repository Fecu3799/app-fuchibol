import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { MatchesPage } from './pages/MatchesPage';
import { MatchDetailPage } from './pages/MatchDetailPage';
import { VenuesPage } from './pages/VenuesPage';
import { SystemPage } from './pages/SystemPage';

export default function App() {
  const { token, login } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to="/" replace /> : <LoginPage onLogin={login} />}
        />
        <Route
          element={token ? <Layout /> : <Navigate to="/login" replace />}
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/:id" element={<UserDetailPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/matches/:id" element={<MatchDetailPage />} />
          <Route path="/venues" element={<VenuesPage />} />
          <Route path="/system" element={<SystemPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
