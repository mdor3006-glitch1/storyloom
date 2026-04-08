import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import api from '../api';

interface DailyBucket {
  date: string;
  signups: number;
  stories: number;
  revenue_credits: number;
}

function bucketByDay(items: { created_at: string; amount?: number }[]): Record<string, { count: number; amount: number }> {
  const map: Record<string, { count: number; amount: number }> = {};
  for (const item of items) {
    const day = item.created_at.slice(0, 10);
    if (!map[day]) map[day] = { count: 0, amount: 0 };
    map[day].count  += 1;
    map[day].amount += item.amount ?? 0;
  }
  return map;
}

export default function StatsPage() {
  const [data,    setData]    = useState<DailyBucket[]>([]);
  const [days,    setDays]    = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/stats?days=${days}`).then(({ data: res }) => {
      const signupMap   = bucketByDay(res.signups);
      const storyMap    = bucketByDay(res.stories);
      const purchaseMap = bucketByDay(res.purchases);

      // Build a sorted array of all dates seen
      const allDates = new Set([
        ...Object.keys(signupMap),
        ...Object.keys(storyMap),
        ...Object.keys(purchaseMap),
      ]);
      const sorted = Array.from(allDates).sort();

      setData(sorted.map((date) => ({
        date,
        signups:         signupMap[date]?.count   ?? 0,
        stories:         storyMap[date]?.count    ?? 0,
        revenue_credits: purchaseMap[date]?.amount ?? 0,
      })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [days]);

  const totalRevenue = data.reduce((s, d) => s + d.revenue_credits, 0);
  const totalSignups = data.reduce((s, d) => s + d.signups, 0);
  const totalStories = data.reduce((s, d) => s + d.stories, 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Stats</h2>
        {([7, 14, 30, 90] as const).map((d) => (
          <button key={d} onClick={() => setDays(d)} style={daysBtn(d === days)}>{d}d</button>
        ))}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        <KpiCard label="Signups" value={totalSignups} />
        <KpiCard label="Stories started" value={totalStories} />
        <KpiCard label="Credits purchased" value={totalRevenue.toLocaleString()} />
      </div>

      {loading ? <p>Loading…</p> : (
        <>
          <ChartCard title="Signups & Stories per Day">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="signups" stroke="#048A81" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="stories" stroke="#2E4057" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Credits Purchased per Day">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue_credits" fill="#048A81" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', flex: 1, boxShadow: '0 1px 4px rgba(46,64,87,0.07)' }}>
      <p style={{ fontSize: 13, color: '#6B7C93', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: '#2E4057' }}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 16, boxShadow: '0 1px 4px rgba(46,64,87,0.07)' }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#2E4057', marginBottom: 16 }}>{title}</p>
      {children}
    </div>
  );
}

const daysBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 16, border: '1.5px solid',
  borderColor: active ? '#048A81' : '#DCE4EB',
  background: active ? '#E6F5F4' : '#fff',
  color: active ? '#048A81' : '#6B7C93',
  fontSize: 13, fontWeight: 600,
});
