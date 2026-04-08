import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';

interface Flag {
  id: string;
  story: { genre: string; setting: string };
  scene: { scene_number: number; scene_text: string; image_url: string } | null;
  reporter: { email: string };
  status: string;
  created_at: string;
}

export default function FlagsPage() {
  const [flags,    setFlags]    = useState<Flag[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<'pending' | 'reviewed' | 'dismissed'>('pending');

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/flags?status=${filter}`);
      setFlags(data.flags);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  async function handleAction(id: string, action: 'reviewed' | 'dismissed') {
    try {
      await api.patch(`/admin/flags/${id}`, { action });
      setFlags((prev) => prev.filter((f) => f.id !== id));
    } catch { alert('Action failed.'); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h2 style={heading}>Flag Queue</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['pending', 'reviewed', 'dismissed'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={filterBtn(s === filter)}>{s}</button>
          ))}
        </div>
      </div>

      {loading ? <p>Loading…</p> : flags.length === 0 ? (
        <div style={empty}>No {filter} flags.</div>
      ) : flags.map((flag) => (
        <div key={flag.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={meta}>{flag.story?.genre} · {flag.story?.setting}</span>
            <span style={meta}>{new Date(flag.created_at).toLocaleDateString()}</span>
          </div>
          {flag.scene && (
            <p style={sceneText}>{flag.scene.scene_text?.slice(0, 300)}…</p>
          )}
          <p style={{ ...meta, marginTop: 8 }}>Reported by: {flag.reporter?.email}</p>
          {filter === 'pending' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={btnReview}   onClick={() => handleAction(flag.id, 'reviewed')}>Mark Reviewed</button>
              <button style={btnDismiss}  onClick={() => handleAction(flag.id, 'dismissed')}>Dismiss</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const heading: React.CSSProperties = { fontSize: 22, fontWeight: 800 };
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 12, boxShadow: '0 1px 4px rgba(46,64,87,0.07)' };
const meta: React.CSSProperties = { fontSize: 12, color: '#6B7C93' };
const sceneText: React.CSSProperties = { fontSize: 14, color: '#2E4057', lineHeight: 1.6, fontStyle: 'italic' };
const empty: React.CSSProperties = { textAlign: 'center', padding: 48, color: '#A0AEBA' };
const filterBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 20, border: '1.5px solid', fontSize: 13, fontWeight: 600,
  borderColor: active ? '#048A81' : '#DCE4EB', background: active ? '#E6F5F4' : '#fff', color: active ? '#048A81' : '#6B7C93',
});
const btnReview:  React.CSSProperties = { background: '#048A81', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13 };
const btnDismiss: React.CSSProperties = { background: '#F0F4F8', color: '#6B7C93', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13 };
