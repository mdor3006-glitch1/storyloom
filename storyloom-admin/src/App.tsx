import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import LoginPage     from './pages/LoginPage';
import FlagsPage     from './pages/FlagsPage';
import UsersPage     from './pages/UsersPage';
import StatsPage     from './pages/StatsPage';

function useAdminToken() {
  return localStorage.getItem('admin_token');
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return useAdminToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  function handleLogout() { localStorage.removeItem('admin_token'); navigate('/login'); }
  const linkStyle = ({ isActive }: { isActive: boolean }) =>
    ({ color: isActive ? '#048A81' : '#2E4057', fontWeight: isActive ? 700 : 400 } as React.CSSProperties);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={nav}>
        <div style={navBrand}>StoryLoom<br /><span style={{ fontSize: 11, color: '#6B7C93' }}>Admin</span></div>
        <NavLink to="/flags" style={linkStyle}>🚩 Flag Queue</NavLink>
        <NavLink to="/users" style={linkStyle}>👥 Users</NavLink>
        <NavLink to="/stats" style={linkStyle}>📊 Stats</NavLink>
        <button onClick={handleLogout} style={logoutBtn}>Sign out</button>
      </nav>
      <main style={{ flex: 1, padding: 32 }}>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route index element={<Navigate to="/flags" replace />} />
                <Route path="flags" element={<FlagsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="stats" element={<StatsPage />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

const nav: React.CSSProperties = {
  width: 200, background: '#fff', padding: '24px 16px',
  display: 'flex', flexDirection: 'column', gap: 16,
  borderRight: '1px solid #F0F4F8',
};
const navBrand: React.CSSProperties = { fontSize: 18, fontWeight: 800, marginBottom: 8, color: '#2E4057' };
const logoutBtn: React.CSSProperties = {
  marginTop: 'auto', background: 'none', border: '1px solid #F0F4F8',
  borderRadius: 8, padding: '8px 12px', color: '#6B7C93', fontSize: 14,
};
