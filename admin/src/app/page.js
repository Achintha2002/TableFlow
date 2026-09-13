"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

function badge(type, text) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function Dashboard() {
  const [stats, setStats] = useState({ queue: 0, orders: 0, reservations: 0, customers: 0, admins: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentQueue, setRecentQueue] = useState([]);
  const [analytics, setAnalytics] = useState({ revenue: [], popularItems: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [
        { count: queueCount }, 
        { count: orderCount }, 
        { count: reservCount }, 
        { count: customerCount },
        { count: adminCount },
        analyticsRes
      ] = await Promise.all([
        supabase.from('queue_entries').select('*', { count: 'exact', head: true }).eq('status', 'waiting'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'preparing']),
        supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        fetch('/api/admin/analytics').then(res => res.json()).catch(() => ({ revenue: [], popularItems: [] }))
      ]);

      const { data: oData } = await supabase.from('orders').select('id, status, total_amount, created_at').order('created_at', { ascending: false }).limit(5);
      const { data: qData } = await supabase.from('queue_entries').select('id, pax, status, joined_at').order('joined_at', { ascending: false }).limit(5);

      setStats({ 
        queue: queueCount || 0, 
        orders: orderCount || 0, 
        reservations: reservCount || 0, 
        customers: customerCount || 0,
        admins: adminCount || 0
      });
      setRecentOrders(oData || []);
      setRecentQueue(qData || []);
      setAnalytics(analyticsRes);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>;

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-label">Waiting Queue</div>
            <div className="stat-card-icon" style={{ background: 'rgba(184,127,92,0.15)' }}>👥</div>
          </div>
          <div className="stat-card-value">{stats.queue}</div>
          <div className="stat-card-change">● Active parties</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-label">Active Orders</div>
            <div className="stat-card-icon" style={{ background: 'rgba(91,155,213,0.15)' }}>🍽️</div>
          </div>
          <div className="stat-card-value">{stats.orders}</div>
          <div className="stat-card-change">● In kitchen</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-label">Confirmed Bookings</div>
            <div className="stat-card-icon" style={{ background: 'rgba(76,175,125,0.15)' }}>📅</div>
          </div>
          <div className="stat-card-value">{stats.reservations}</div>
          <div className="stat-card-change">● Tonight</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-label">Total Admins</div>
            <div className="stat-card-icon" style={{ background: 'rgba(75, 192, 192, 0.15)' }}>🛡️</div>
          </div>
          <div className="stat-card-value">{stats.admins}</div>
          <div className="stat-card-change">● Managers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-label">Registered Customers</div>
            <div className="stat-card-icon" style={{ background: 'rgba(212,175,55,0.15)' }}>⭐</div>
          </div>
          <div className="stat-card-value">{stats.customers}</div>
          <div className="stat-card-change">● App Users</div>
        </div>
      </div>

      <div className="data-grid" style={{ marginTop: '24px' }}>
        <div className="data-card">
          <div className="data-card-header">
            <h3>Revenue (Last 7 Days)</h3>
          </div>
          <div style={{ height: '300px', width: '100%', padding: '16px 0' }}>
            {analytics.revenue && analytics.revenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.revenue}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B87F5C" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#B87F5C" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `LKR ${val}`} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--primary)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#B87F5C" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" activeDot={{ r: 6, fill: '#B87F5C' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No revenue data</div>
            )}
          </div>
        </div>
        <div className="data-card">
          <div className="data-card-header">
            <h3>Popular Items</h3>
          </div>
          <div style={{ height: '300px', width: '100%', padding: '16px 0' }}>
            {analytics.popularItems && analytics.popularItems.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.popularItems} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="count" fill="#B87F5C" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No items data</div>
            )}
          </div>
        </div>
      </div>

      <div className="data-grid" style={{ marginTop: '24px' }}>
        <div className="data-card">
          <div className="data-card-header">
            <h3>Recent Orders</h3>
            <Link href="/orders" className="btn btn-ghost">View all</Link>
          </div>
          <table className="data-table">
            <thead><tr><th>Order ID</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              {recentOrders.length > 0 ? recentOrders.map(o => (
                <tr key={o.id}>
                  <td style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>#{o.id.slice(0,8)}</td>
                  <td>LKR {(o.total_amount ?? 0).toFixed(2)}</td>
                  <td>{badge(o.status === 'served' ? 'success' : o.status === 'preparing' ? 'info' : o.status === 'pending' ? 'warning' : 'muted', o.status)}</td>
                  <td>{fmtTime(o.created_at)}</td>
                </tr>
              )) : <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No orders yet</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="data-card">
          <div className="data-card-header">
            <h3>Live Queue</h3>
            <Link href="/queue" className="btn btn-ghost">View all</Link>
          </div>
          <table className="data-table">
            <thead><tr><th>Entry ID</th><th>Party</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {recentQueue.length > 0 ? recentQueue.map(q => (
                <tr key={q.id}>
                  <td style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>#{q.id.slice(0,8)}</td>
                  <td>{q.pax}</td>
                  <td>{badge(q.status === 'seated' ? 'success' : q.status === 'waiting' ? 'warning' : 'muted', q.status)}</td>
                  <td>{fmtTime(q.joined_at)}</td>
                </tr>
              )) : <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Queue is empty</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
