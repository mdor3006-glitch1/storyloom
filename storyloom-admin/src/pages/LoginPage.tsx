import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? '/api';
      const { data } = await axios.post(`${baseUrl}/auth/login`, { email, password });
      // Backend returns { user, token }. Check is_admin on the user.
      if (!data.user?.is_admin) { setError('Not an admin account.'); return; }
      localStorage.setItem('admin_token', data.token);
      navigate('/flags');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>StoryLoom Admin</h1>
        <p style={{ color: '#6B7C93', marginBottom: 24, fontSize: 14 }}>Sign in with your admin account</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p style={{ color: '#E0533A', fontSize: 14 }}>{error}</p>}
          <button type="submit" style={btn} disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  );
}
const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4F8' };
const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: 32, width: 360, boxShadow: '0 4px 24px rgba(46,64,87,0.1)' };
const input: React.CSSProperties = { padding: '12px 14px', borderRadius: 8, border: '1.5px solid #DCE4EB', fontSize: 15, outline: 'none', width: '100%' };
const btn: React.CSSProperties = { background: '#048A81', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontWeight: 700, fontSize: 15 };
