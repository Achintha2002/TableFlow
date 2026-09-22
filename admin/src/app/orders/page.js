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
  const [toast, setToast] = useState(null);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, 
        total_amount, 
        status, 
        payment_status,
        created_at,
        users (full_name),
        restaurant_tables (table_number),
        order_items (quantity, menu_items (name)),
        reviews (rating, comment)
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

    const reviewChannel = supabase.channel('admin_orders_reviews').on('postgres_changes',
      { event: '*', schema: 'public', table: 'reviews' },
      () => { fetchOrders(); }
    ).subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      supabase.removeChannel(reviewChannel);
    };
  }, []);

  async function updateStatus(id, newStatus) {
    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    if (error) {
      console.error('Order status update error:', error);
      showToast(`Failed to update status: ${error.message}`, true);
      fetchOrders();
    } else {
      showToast(`Order #${id.slice(0, 8)} status updated to "${newStatus.toUpperCase()}"!`);
      fetchOrders();
    }
  }

  async function updatePaymentStatus(id, newStatus) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, payment_status: newStatus } : o));
    const { error } = await supabase.from('orders').update({ payment_status: newStatus }).eq('id', id);
    if (error) {
      console.error('Payment update error:', error);
      showToast('Payment update failed', true);
      fetchOrders();
    } else {
      showToast(`Order #${id.slice(0, 8)} marked as PAID!`);
      fetchOrders();
    }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading orders...</p>;

  return (
    <div className="full-data-card" style={{ position: 'relative' }}>
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: toast.isError ? '#dc2626' : '#16a34a',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 9999,
          fontWeight: 'bold',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toast.isError ? '⚠️' : '✅'} {toast.msg}
        </div>
      )}
      <div className="data-card-header">
        <h3>Kitchen & Orders ({orders.length})</h3>
      </div>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Table</th>
              <th>Items</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Guest Rating</th>
              <th>Time Ordered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? orders.map(o => (
              <tr key={o.id}>
                <td style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>#{o.id.slice(0,8)}</td>
                <td>{o.users?.full_name || 'Guest'}</td>
                <td>{o.restaurant_tables?.table_number ? `T-${o.restaurant_tables.table_number}` : '—'}</td>
                <td style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '200px' }}>
                  {o.order_items?.map(item => `${item.quantity}x ${item.menu_items?.name}`).join(', ') || '—'}
                </td>
                <td>LKR {(o.total_amount ?? 0).toFixed(2)}</td>
                <td>{badge(o.status === 'served' ? 'success' : o.status === 'preparing' ? 'info' : o.status === 'pending' ? 'warning' : 'muted', o.status)}</td>
                <td>
                  <button 
                    onClick={() => o.payment_status !== 'paid' ? updatePaymentStatus(o.id, 'paid') : null}
                    style={{
                      backgroundColor: o.payment_status === 'paid' ? 'var(--success-green)' : 'var(--primary-gold)',
                      border: 'none',
                      color: o.payment_status === 'paid' ? '#000' : 'var(--white)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: o.payment_status === 'paid' ? 'default' : 'pointer'
                    }}
                  >
                    {o.payment_status === 'paid' ? 'PAID' : 'Mark as Paid'}
                  </button>
                </td>
                <td>
                  {o.reviews && o.reviews.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: 'var(--primary-gold)', fontWeight: 'bold', fontSize: '13px' }}>
                        {'★'.repeat(o.reviews[0].rating || 5)}{'☆'.repeat(5 - (o.reviews[0].rating || 5))} ({o.reviews[0].rating}/5)
                      </span>
                      {o.reviews[0].comment && (
                        <span 
                          style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} 
                          title={o.reviews[0].comment}
                        >
                          "{o.reviews[0].comment}"
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                  )}
                </td>
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
            )) : <tr><td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No orders found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
