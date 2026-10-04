"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
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

function extractDiscountInfo(o) {
  let discount = Number(o.discount_amount) || 0;
  let subtotal = Number(o.subtotal) || 0;
  let code = null;

  const notes = o.special_notes || '';
  
  // 1. Check coupon tag [Coupon: CODE (-LKR XXX)]
  const couponMatch = notes.match(/\[Coupon:\s*([A-Z0-9_\-]+)(?:\s*\(-LKR\s*([\d\.]+)\))?\]/i);
  if (couponMatch) {
    code = couponMatch[1];
    if (couponMatch[2] && discount === 0) {
      discount = parseFloat(couponMatch[2]);
    }
  }

  // 2. Check points discount [Points Discount: -LKR XXX]
  const pointsMatch = notes.match(/\[Points Discount:\s*-LKR\s*([\d\.]+)\]/i);
  if (pointsMatch && discount === 0) {
    discount = parseFloat(pointsMatch[1]);
    code = 'Points';
  }

  // 3. Check general discount [Discount: LKR XXX] or [Settled: ... Discount: LKR XXX]
  const discountMatch = notes.match(/Discount:\s*LKR\s*([\d\.]+)/i);
  if (discountMatch && discount === 0) {
    discount = parseFloat(discountMatch[1]);
  }

  // 4. Implied gross subtotal
  if (subtotal === 0 && discount > 0) {
    subtotal = (Number(o.total_amount) || 0) + discount;
  } else if (subtotal > 0 && discount === 0 && subtotal > (Number(o.total_amount) || 0)) {
    discount = Math.round((subtotal - (Number(o.total_amount) || 0)) * 100) / 100;
  }

  return { discount, subtotal, code };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [filterTab, setFilterTab] = useState('active'); // 'active' | 'awaiting_audit' | 'all'
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  }

  // Cross-tab notification helper
  function notifyOrdersUpdated() {
    try {
      if (typeof window !== 'undefined') {
        if (window.BroadcastChannel) {
          const bc = new BroadcastChannel('tableflow_orders_channel');
          bc.postMessage({ type: 'ORDERS_CHANGED', timestamp: Date.now() });
          bc.close();
        }
        localStorage.setItem('tableflow_orders_last_updated', Date.now().toString());
      }
    } catch (_) {}
  }

  const isAwaitingVerification = (o) => {
    // 1. If order is cancelled, rejected, served or completed -> NOT awaiting audit
    if (['cancelled', 'served', 'completed', 'payment_rejected'].includes(o.status)) return false;
    
    // 2. If payment is already marked as paid or failed -> NOT awaiting audit
    if (o.payment_status === 'paid' || o.payment_status === 'failed') return false;

    // 3. If special notes indicate it was rejected -> NOT awaiting audit
    const notes = (o.special_notes || '').toLowerCase();
    if (notes.includes('[rejected:') || notes.includes('payment rejected') || notes.includes('payment_rejected')) return false;

    // 4. Must be a bank transfer order
    const isBank = (o.payment_method === 'bank_transfer') || 
                   o.status === 'payment_pending' || 
                   notes.includes('bank transfer') || 
                   notes.includes('[bank transfer ref:');

    return Boolean(isBank);
  };

  async function fetchOrders() {
    let { data, error } = await supabase
      .from('orders')
      .select(`
        id, 
        total_amount, 
        subtotal,
        discount_amount,
        status, 
        payment_status,
        special_notes,
        created_at,
        users (full_name),
        restaurant_tables (table_number),
        order_items (quantity, menu_items (name)),
        reviews (rating, comment)
      `)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.warn('Fetch orders with discount notice, falling back:', error.message || error);
      const fallback = await supabase
        .from('orders')
        .select(`
          id, 
          total_amount, 
          status, 
          payment_status,
          special_notes,
          created_at,
          users (full_name),
          restaurant_tables (table_number),
          order_items (quantity, menu_items (name)),
          reviews (rating, comment)
        `)
        .order('created_at', { ascending: false });
      data = fallback.data;
    }
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
    
    // Unique channel names to prevent Supabase Realtime channel clashes
    const channelId = Math.random().toString(36).substring(2, 9);
    
    const orderChannel = supabase.channel(`admin_orders_${channelId}`).on('postgres_changes', 
      { event: '*', schema: 'public', table: 'orders' }, 
      () => { fetchOrders(); }
    ).subscribe();

    const transChannel = supabase.channel(`admin_trans_${channelId}`).on('postgres_changes',
      { event: '*', schema: 'public', table: 'payment_transactions' },
      () => { fetchOrders(); }
    ).subscribe();

    const reviewChannel = supabase.channel(`admin_rev_${channelId}`).on('postgres_changes',
      { event: '*', schema: 'public', table: 'reviews' },
      () => { fetchOrders(); }
    ).subscribe();

    // Cross-tab / cross-window live sync via BroadcastChannel
    let bc = null;
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        bc = new BroadcastChannel('tableflow_orders_channel');
        bc.onmessage = () => {
          fetchOrders();
        };
      }
    } catch (_) {}

    // Storage event sync fallback across browser tabs
    const onStorage = (e) => {
      if (e.key === 'tableflow_orders_last_updated') {
        fetchOrders();
      }
    };
    window.addEventListener('storage', onStorage);

    // Instant refresh when user returns to this tab / window
    const onFocus = () => fetchOrders();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchOrders();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Fast polling heartbeat (4s) ensuring 100% live updates even if websockets drop
    const pollInterval = setInterval(fetchOrders, 4000);

    return () => { 
      supabase.removeChannel(orderChannel); 
      supabase.removeChannel(transChannel);
      supabase.removeChannel(reviewChannel);
      if (bc) bc.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(pollInterval);
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
      notifyOrdersUpdated();
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
      notifyOrdersUpdated();
      fetchOrders();
    }
  }

  const awaitingOrders = orders.filter(isAwaitingVerification);
  const activeOrders = orders.filter(o => 
    !isAwaitingVerification(o) && 
    !['payment_rejected', 'cancelled'].includes(o.status)
  );
  
  const displayedOrders = filterTab === 'active' 
    ? activeOrders 
    : filterTab === 'awaiting_audit' 
      ? awaitingOrders 
      : orders;

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

      {/* Audit Alert Banner when unapproved bank transfers exist */}
      {awaitingOrders.length > 0 && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 18px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#fbbf24',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⏳</span>
            <span style={{ fontSize: '13px' }}>
              <strong>{awaitingOrders.length} online transfer order(s)</strong> awaiting payment audit approval. Orders will automatically place into this kitchen queue as soon as verified.
            </span>
          </div>
          <Link 
            href="/payment-audit"
            style={{
              background: '#d97706',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Review Slips in Audit Desk →
          </Link>
        </div>
      )}

      <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Kitchen & Orders ({displayedOrders.length})</h3>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterTab('active')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: filterTab === 'active' ? 'var(--primary-gold)' : 'var(--border-color)',
              backgroundColor: filterTab === 'active' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              color: filterTab === 'active' ? 'var(--primary-gold)' : 'var(--text-muted)',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Active Kitchen Queue ({activeOrders.length})
          </button>
          <button
            onClick={() => setFilterTab('awaiting_audit')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: filterTab === 'awaiting_audit' ? '#f59e0b' : 'var(--border-color)',
              backgroundColor: filterTab === 'awaiting_audit' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: filterTab === 'awaiting_audit' ? '#f59e0b' : 'var(--text-muted)',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <span>Awaiting Audit</span>
            {awaitingOrders.length > 0 && (
              <span style={{
                background: '#f59e0b',
                color: '#000',
                borderRadius: '10px',
                padding: '1px 6px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                {awaitingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterTab('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: filterTab === 'all' ? 'var(--primary-gold)' : 'var(--border-color)',
              backgroundColor: filterTab === 'all' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              color: filterTab === 'all' ? 'var(--primary-gold)' : 'var(--text-muted)',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            All Orders ({orders.length})
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '13%' }}>Order</th>
              <th style={{ width: '17%' }}>Table & Customer</th>
              <th style={{ width: '24%' }}>Items</th>
              <th style={{ width: '16%' }}>Total Amount</th>
              <th style={{ width: '10%' }}>Status</th>
              <th style={{ width: '10%' }}>Payment</th>
              <th style={{ width: '10%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedOrders.length > 0 ? displayedOrders.map(o => {
              const isAwaiting = isAwaitingVerification(o);
              const { discount, subtotal, code } = extractDiscountInfo(o);
              const finalAmount = Number(o.total_amount ?? 0);
              const displaySubtotal = subtotal > 0 ? subtotal : (discount > 0 ? (finalAmount + discount) : finalAmount);

              return (
                <tr key={o.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: '700', fontSize: '13px' }}>
                      #{o.id.slice(0,8)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {fmtTime(o.created_at)}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {o.restaurant_tables?.table_number ? (
                        <span style={{
                          background: 'rgba(184, 127, 92, 0.12)',
                          color: 'var(--primary)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          whiteSpace: 'nowrap'
                        }}>
                          T-{o.restaurant_tables.table_number}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', whiteSpace: 'nowrap' }}>Takeaway</span>
                      )}
                      <span style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '13px' }}>
                        {o.users?.full_name || 'Guest'}
                      </span>
                    </div>
                    {o.reviews && o.reviews.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                        <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 'bold' }}>
                          ★ {o.reviews[0].rating}/5
                        </span>
                        {o.reviews[0].comment && (
                          <span 
                            style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} 
                            title={o.reviews[0].comment}
                          >
                            &quot;{o.reviews[0].comment}&quot;
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div style={{ lineHeight: '1.4' }}>
                      {o.order_items?.map(item => `${item.quantity}x ${item.menu_items?.name}`).join(', ') || '—'}
                    </div>
                    {o.special_notes && !o.special_notes.startsWith('[Bank Transfer Ref:') && (
                      <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '3px', fontStyle: 'italic', wordBreak: 'break-word' }}>
                        📝 {o.special_notes.replace(/\[Bank Transfer Ref:[^\]]+\]/g, '').trim()}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px' }}>
                      LKR {finalAmount.toFixed(2)}
                    </div>
                    {discount > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: '700'
                        }}>
                          🏷️ -LKR {discount.toFixed(2)} {code ? `(${code})` : ''}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          LKR {displaySubtotal.toFixed(2)}
                        </span>
                      </div>
                    ) : null}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {isAwaiting ? (
                      <span style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        Awaiting Audit
                      </span>
                    ) : (
                      badge(
                        o.status === 'served' ? 'success' : 
                        o.status === 'preparing' ? 'info' : 
                        o.status === 'pending' ? 'warning' : 
                        (o.status === 'cancelled' || o.status === 'payment_rejected') ? 'danger' : 'muted', 
                        o.status
                      )
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {isAwaiting ? (
                      <span style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        padding: '3px 7px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        ⏳ Slip Verification
                      </span>
                    ) : o.payment_status === 'failed' ? (
                      <span style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        padding: '3px 7px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        ✕ Rejected
                      </span>
                    ) : (
                      <button 
                        onClick={() => o.payment_status !== 'paid' ? updatePaymentStatus(o.id, 'paid') : null}
                        style={{
                          backgroundColor: o.payment_status === 'paid' ? 'var(--success-green)' : 'var(--primary-gold)',
                          border: 'none',
                          color: o.payment_status === 'paid' ? '#000' : 'var(--white)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: o.payment_status === 'paid' ? 'default' : 'pointer'
                        }}
                      >
                        {o.payment_status === 'paid' ? 'PAID' : 'Mark as Paid'}
                      </button>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {isAwaiting ? (
                      <Link
                        href="/payment-audit"
                        style={{
                          backgroundColor: '#f59e0b',
                          color: '#000',
                          padding: '4px 9px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        Verify Slip →
                      </Link>
                    ) : (
                      <select 
                        className="status-dropdown" 
                        value={o.status}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-light)',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          fontSize: '11.5px',
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
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px 16px' }}>
                  {filterTab === 'awaiting_audit' ? 'No orders awaiting payment audit! All clear.' : 'No orders found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
