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
    
    // Attempt Supabase Realtime (requires replication enabled in DB)
    const channel = supabase.channel('admin_orders').on('postgres_changes', 
      { event: '*', schema: 'public', table: 'orders' }, 
      () => { fetchOrders(); }
    ).subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
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
              <td>LKR {(o.total_amount ?? 0).toFixed(2)}</td>
              <td>{badge(o.status === 'served' ? 'success' : o.status === 'preparing' ? 'info' : o.status === 'pending' ? 'warning' : 'muted', o.status)}</td>
              <td>{fmtTime(o.created_at)}</td>
              <td>
                <select 
                  className="status-dropdown" 
                  value={o.status}
                  onChange={(e) => updateStatus(o.id, e.target.value)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-light)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="pending" style={{ color: '#000' }}>Pending</option>
                  <option value="preparing" style={{ color: '#000' }}>Preparing</option>
                  <option value="ready" style={{ color: '#000' }}>Ready</option>
                  <option value="served" style={{ color: '#000' }}>Served</option>
                  <option value="cancelled" style={{ color: '#000' }}>Cancelled</option>
                </select>
              </td>
            </tr>
          )) : <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No orders found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
