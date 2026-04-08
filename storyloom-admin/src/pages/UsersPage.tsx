import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  credit_balance: number;
  is_admin: boolean;
  language: string;
  created_at: string;
  last_active_at: string | null;
}

export default function UsersPage() {
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/users?search=${encodeURIComponent(search)}`);
      setUsers(data.users);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h2 style={heading}>Users</h2>
        <input
          style={searchInput}
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
        />
      </div>

      {loading ? <p>Loading…</p> : (
        <table style={table}>
          <thead>
            <tr>
              {['Email', 'Name', 'Credits', 'Lang', 'Admin', 'Joined', 'Last Active'].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={trStyle}>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.display_name || '—'}</td>
                <td style={{ ...td, fontWeight: 700, color: '#048A81' }}>{u.credit_balance}</td>
                <td style={td}>{u.language.toUpperCase()}</td>
                <td style={td}>{u.is_admin ? '✓' : ''}</td>
                <td style={td}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={td}>{u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const heading: React.CSSProperties = { fontSize: 22, fontWeight: 800 };
const searchInput: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1.5px solid #DCE4EB', fontSize: 14, outline: 'none', width: 260 };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(46,64,87,0.07)' };
const th: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7C93', textTransform: 'uppercase', letterSpacing: 0.5, background: '#F0F4F8' };
const td: React.CSSProperties = { padding: '12px 16px', fontSize: 14, color: '#2E4057', borderTop: '1px solid #F0F4F8' };
const trStyle: React.CSSProperties = { transition: 'background 0.1s' };
