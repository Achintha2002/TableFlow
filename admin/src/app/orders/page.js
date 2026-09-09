"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

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

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, 
        total_amount, 
        status, 
        created_at
      `)
      .order('created_at', { ascending: false });
      
    if (error) console.error(error);
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel('admin_orders').on('postgres_changes', 
      { event: '*', schema: 'public', table: 'orders' }, 
      () => { fetchOrders(); }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function updateStatus(id, newStatus) {
    await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    fetchOrders();
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading orders...</p>;

  return (
    <div className="full-data-card">
      <div className="data-card-header">
        <h3>Kitchen & Orders ({orders.length})</h3>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th>Time Ordered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.length > 0 ? orders.map(o => (
            <tr key={o.id}>
              <td style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>#{o.id.slice(0,8)}</td>
              <td>${(o.total_amount ?? 0).toFixed(2)}</td>
              <td>{badge(o.status === 'served' ? 'success' : o.status === 'preparing' ? 'info' : o.status === 'pending' ? 'warning' : 'muted', o.status)}</td>
              <td>{fmtTime(o.created_at)}</td>
              <td>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {o.status === 'pending' && (
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => updateStatus(o.id, 'preparing')}>Prep</button>
                  )}
                  {o.status === 'preparing' && (
                    <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => updateStatus(o.id, 'ready')}>Ready</button>
                  )}
                  {o.status === 'ready' && (
                    <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--success-green)' }} onClick={() => updateStatus(o.id, 'served')}>Serve</button>
                  )}
                </div>
              </td>
            </tr>
          )) : <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No orders found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
