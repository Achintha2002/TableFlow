"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

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
  const [stats, setStats] = useState({ queue: 0, orders: 0, reservations: 0, users: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentQueue, setRecentQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [{ count: queueCount }, { count: orderCount }, { count: reservCount }, { count: userCount }] = await Promise.all([
        supabase.from('queue_entries').select('*', { count: 'exact', head: true }).eq('status', 'waiting'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'preparing']),
        supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('users').select('*', { count: 'exact', head: true }),
      ]);

      const { data: oData } = await supabase.from('orders').select('id, status, total_amount, created_at').order('created_at', { ascending: false }).limit(5);
      const { data: qData } = await supabase.from('queue_entries').select('id, party_size, status, created_at').order('created_at', { ascending: false }).limit(5);

      setStats({ queue: queueCount || 0, orders: orderCount || 0, reservations: reservCount || 0, users: userCount || 0 });
      setRecentOrders(oData || []);
      setRecentQueue(qData || []);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>;

  return (
    <>
      <div className="stats-grid">
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
            <div className="stat-card-label">Total Users</div>
            <div className="stat-card-icon" style={{ background: 'rgba(212,175,55,0.15)' }}>⭐</div>
          </div>
          <div className="stat-card-value">{stats.users}</div>
          <div className="stat-card-change">● Registered</div>
        </div>
      </div>

      <div className="data-grid">
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
                  <td>${(o.total_amount ?? 0).toFixed(2)}</td>
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
                  <td>👥 {q.party_size}</td>
                  <td>{badge(q.status === 'seated' ? 'success' : q.status === 'waiting' ? 'warning' : 'muted', q.status)}</td>
                  <td>{fmtTime(q.created_at)}</td>
                </tr>
              )) : <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Queue is empty</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
