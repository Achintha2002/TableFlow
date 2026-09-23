"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  FileCheck, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Copy, 
  Check, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Ban
} from 'lucide-react';

const CANNED_REASONS = [
  "Reference number not found on bank statement",
  "Amount mismatch (paid amount is less than order total)",
  "Slip image is blurry or illegible",
  "Duplicate receipt already used for another order",
  "Transferred to incorrect bank account"
];

export default function PaymentAuditPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending'); // 'pending', 'all', 'rejected'
  const [activeModalOrder, setActiveModalOrder] = useState(null); // for slip preview lightbox
  const [rejectingOrder, setRejectingOrder] = useState(null); // for reject reason modal
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [copiedRef, setCopiedRef] = useState(null);

  // Lightbox view state (zoom & rotation)
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchVerificationQueue() {
    try {
      setRefreshing(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let queueOrders = null;

      // 1. Try fetching from backend endpoint if session token exists
      if (token) {
        try {
          const res = await fetch('http://localhost:3000/api/admin/orders/pending-verification', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            queueOrders = data.orders || [];
          } else {
            const errData = await res.json().catch(() => null);
            console.warn('Backend verification API notice:', errData?.error || res.statusText);
          }
        } catch (fetchErr) {
          console.warn('Backend fetch notice:', fetchErr.message);
        }
      }

      // 2. If backend succeeded, update orders and return
      if (queueOrders !== null) {
        setOrders(queueOrders);
        return;
      }

      // 3. Resilient Direct Supabase Fallback (Identical to Orders page)
      const { data: dbOrders, error: dbErr } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          payment_status,
          payment_method,
          special_notes,
          created_at,
          users (id, full_name, email, phone_number),
          restaurant_tables (table_number),
          order_items (
            id,
            quantity,
            unit_price,
            menu_items (id, name, price, image_url)
          )
        `)
        .order('created_at', { ascending: false });

      if (dbErr) {
        console.warn('Direct DB fetch notice:', dbErr.message);
        showToast(dbErr.message, true);
        return;
      }

      // Filter bank transfer orders needing verification
      const bankOrders = (dbOrders || []).filter(o => 
        o.payment_method === 'bank_transfer' || 
        o.status === 'payment_pending' || 
        o.status === 'payment_rejected' ||
        (o.payment_status === 'pending' && !['served', 'completed', 'cancelled'].includes(o.status))
      );

      // Fetch payment transactions if available
      let transMap = new Map();
      if (bankOrders.length > 0) {
        try {
          const orderIds = bankOrders.map(o => o.id);
          const { data: transData } = await supabase
            .from('payment_transactions')
            .select('*')
            .in('order_id', orderIds);
          if (transData) {
            transData.forEach(t => transMap.set(t.order_id, t));
          }
        } catch (_) {}
      }

      // Generate signed URLs if slips exist
      const enriched = await Promise.all(bankOrders.map(async (order) => {
        let trans = transMap.get(order.id) || null;
        let slipUrl = null;
        const refMatch = order.special_notes?.match(/Ref:\s*([A-Za-z0-9_-]+)/i);
        const slipMatch = order.special_notes?.match(/Slip:\s*([^\s\]]+)/i);
        const slipPath = trans?.slip_path || (slipMatch ? slipMatch[1] : null);

        if (slipPath) {
          try {
            const { data } = await supabase.storage
              .from('payment-slips')
              .createSignedUrl(slipPath, 3600);
            slipUrl = data?.signedUrl || null;
          } catch (_) {}
        }

        if (!trans && (refMatch || slipUrl)) {
          trans = {
            order_id: order.id,
            transaction_reference: refMatch ? refMatch[1] : `BT-${order.id}`,
            slip_url: slipUrl,
            status: order.payment_status === 'failed' ? 'rejected' : 'pending_verification'
          };
        } else if (trans) {
          trans = { ...trans, slip_url: slipUrl };
        }

        return {
          ...order,
          payment_transaction: trans
        };
      }));

      setOrders(enriched);
    } catch (err) {
      console.warn('Fetch queue notice:', err.message);
      showToast(err.message, true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchVerificationQueue();

    // Listen to realtime changes on orders & payment_transactions
    const ordersChannel = supabase
      .channel('payment_audit_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchVerificationQueue();
      })
      .subscribe();

    const transChannel = supabase
      .channel('payment_audit_trans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions' }, () => {
        fetchVerificationQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(transChannel);
    };
  }, []);

  // Handle Approve
  async function handleApprove(orderId) {
    try {
      setIsProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let success = false;
      if (token) {
        try {
          const res = await fetch(`http://localhost:3000/api/admin/orders/${orderId}/verify`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'approve' })
          });
          if (res.ok) success = true;
        } catch (_) {}
      }

      if (!success) {
        // Fallback directly to Supabase update
        const { error: upErr } = await supabase
          .from('orders')
          .update({
            status: 'pending',
            payment_status: 'paid'
          })
          .eq('id', orderId);

        if (upErr) throw new Error(upErr.message);

        try {
          await supabase
            .from('payment_transactions')
            .update({
              status: 'approved',
              updated_at: new Date().toISOString()
            })
            .eq('order_id', orderId);
        } catch (_) {}
      }

      showToast(`Order #${orderId} payment verified! Food order sent to kitchen.`);
      setActiveModalOrder(null);
      fetchVerificationQueue();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setIsProcessing(false);
    }
  }

  // Handle Reject
  async function handleConfirmReject() {
    if (!rejectingOrder) return;
    try {
      setIsProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const reason = rejectionReason || 'Payment verification failed';

      let success = false;
      if (token) {
        try {
          const res = await fetch(`http://localhost:3000/api/admin/orders/${rejectingOrder.id}/verify`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              action: 'reject',
              rejection_reason: reason
            })
          });
          if (res.ok) success = true;
        } catch (_) {}
      }

      if (!success) {
        // Fallback directly to Supabase update
        let { error: rejErr } = await supabase
          .from('orders')
          .update({
            status: 'payment_rejected',
            payment_status: 'failed'
          })
          .eq('id', rejectingOrder.id);

        if (rejErr) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'failed'
            })
            .eq('id', rejectingOrder.id);
        }

        try {
          await supabase
            .from('payment_transactions')
            .update({
              status: 'rejected',
              rejection_reason: reason,
              updated_at: new Date().toISOString()
            })
            .eq('order_id', rejectingOrder.id);
        } catch (_) {}
      }

      showToast(`Order #${rejectingOrder.id} payment rejected. Customer notified.`);
      setRejectingOrder(null);
      setRejectionReason('');
      setActiveModalOrder(null);
      fetchVerificationQueue();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setIsProcessing(false);
    }
  }

  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedRef(text);
    setTimeout(() => setCopiedRef(null), 2000);
  }

  function isOrderRejected(order) {
    if (order.status === 'payment_rejected') return true;
    if (order.payment_transaction?.status === 'rejected') return true;
    if (order.payment_status === 'failed') return true;
    return false;
  }

  function isOrderApproved(order) {
    if (order.payment_status === 'paid') return true;
    if (order.payment_transaction?.status === 'approved') return true;
    return false;
  }

  function isOrderPending(order) {
    if (isOrderRejected(order)) return false;
    if (isOrderApproved(order)) return false;
    return true;
  }

  // Filters
  const filteredOrders = orders.filter(order => {
    // Status filter
    if (filterStatus === 'pending' && !isOrderPending(order)) return false;
    if (filterStatus === 'rejected' && !isOrderRejected(order)) return false;

    // Search filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const orderId = String(order.id);
    const ref = (order.payment_transaction?.transaction_reference || order.special_notes || '').toLowerCase();
    const custName = (order.users?.full_name || '').toLowerCase();
    const phone = (order.users?.phone_number || '').toLowerCase();
    return orderId.includes(q) || ref.includes(q) || custName.includes(q) || phone.includes(q);
  });

  const pendingCount = orders.filter(isOrderPending).length;
  const rejectedCount = orders.filter(isOrderRejected).length;
  const totalPendingValue = orders
    .filter(isOrderPending)
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, paddingBottom: '32px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: toast.isError ? '#ef4444' : '#10b981',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toast.isError ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileCheck size={28} color="#f59e0b" />
            Payment Audit Desk
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Review manual direct bank transfer slips, verify transaction references, and release orders to the kitchen.
          </p>
        </div>
        <button
          onClick={fetchVerificationQueue}
          disabled={refreshing}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh Queue'}
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '10px', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Awaiting Verification</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{pendingCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '10px', color: '#10b981' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Pending Revenue Hold</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>LKR {totalPendingValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '10px', color: '#ef4444' }}>
            <Ban size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Rejected / Disputed</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{rejectedCount}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ 
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px 18px', 
        marginBottom: '20px', 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '12px', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* Segmented Filter Pills */}
        <div style={{ 
          display: 'inline-flex', 
          background: '#f1f5f9', 
          padding: '3px', 
          borderRadius: '9px',
          gap: '3px'
        }}>
          <button
            onClick={() => setFilterStatus('pending')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'pending' ? 600 : 500,
              background: filterStatus === 'pending' ? '#ffffff' : 'transparent',
              color: filterStatus === 'pending' ? '#0f172a' : '#64748b',
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: filterStatus === 'pending' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Pending Verification
            <span style={{
              background: filterStatus === 'pending' ? 'rgba(245, 158, 11, 0.18)' : '#e2e8f0',
              color: filterStatus === 'pending' ? '#b45309' : '#64748b',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}>
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => setFilterStatus('rejected')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'rejected' ? 600 : 500,
              background: filterStatus === 'rejected' ? '#ffffff' : 'transparent',
              color: filterStatus === 'rejected' ? '#0f172a' : '#64748b',
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: filterStatus === 'rejected' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Rejected
            <span style={{
              background: filterStatus === 'rejected' ? 'rgba(239, 68, 68, 0.18)' : '#e2e8f0',
              color: filterStatus === 'rejected' ? '#ef4444' : '#64748b',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}>
              {rejectedCount}
            </span>
          </button>

          <button
            onClick={() => setFilterStatus('all')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'all' ? 600 : 500,
              background: filterStatus === 'all' ? '#ffffff' : 'transparent',
              color: filterStatus === 'all' ? '#0f172a' : '#64748b',
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: filterStatus === 'all' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            All Submissions
            <span style={{
              background: '#e2e8f0',
              color: '#64748b',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}>
              {orders.length}
            </span>
          </button>
        </div>

        {/* Modern Clean Search Bar (White background, luxury border & focus) */}
        <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
          <Search 
            size={15} 
            style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: '#94a3b8',
              pointerEvents: 'none'
            }} 
          />
          <input
            type="text"
            placeholder="Search Order #, Ref #, Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              paddingLeft: '34px', 
              paddingRight: searchQuery ? '30px' : '12px',
              paddingTop: '8px',
              paddingBottom: '8px',
              width: '100%', 
              fontSize: '0.83rem',
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#B87F5C';
              e.target.style.boxShadow = '0 0 0 3px rgba(184, 127, 92, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px'
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Verification Queue Table (Single page, NO horizontal scroll) */}
      <div style={{ 
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', display: 'block', color: '#f59e0b' }} />
            Loading verification queue...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <CheckCircle2 size={36} style={{ margin: '0 auto 12px auto', display: 'block', color: '#10b981' }} />
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>All Caught Up!</h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>No pending bank transfer payments waiting for verification.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600 }}>Order</th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600 }}>Bank Reference</th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600 }}>Items</th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600 }}>Slip</th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => {
                const trans = order.payment_transaction;
                const isPending = isOrderPending(order);
                const isRejected = isOrderRejected(order);
                const isApproved = isOrderApproved(order);
                const elapsedMin = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);

                return (
                  <tr 
                    key={order.id} 
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Order Info */}
                    <td style={{ padding: '12px 14px' }}>
                      <div 
                        style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', letterSpacing: '0.5px' }}
                        title={`Full Order ID: #${order.id}`}
                      >
                        #{String(order.id).length > 12 ? `${String(order.id).slice(0, 8)}...` : order.id}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Clock size={11} /> {elapsedMin < 60 ? `${elapsedMin}m ago` : `${Math.floor(elapsedMin / 60)}h ago`}
                        {order.restaurant_tables && (
                          <span style={{ marginLeft: '2px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', padding: '1px 5px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600 }}>
                            T-{order.restaurant_tables.table_number}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Customer Info */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>
                        {order.users?.full_name || 'Guest User'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>
                        {order.users?.phone_number || order.users?.email || 'No contact'}
                      </div>
                    </td>

                    {/* Bank Ref Number */}
                    <td style={{ padding: '12px 14px' }}>
                      {trans?.transaction_reference ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <code style={{ 
                            background: 'rgba(184, 127, 92, 0.1)', 
                            color: '#9c6848',
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '0.76rem', 
                            fontWeight: 700, 
                            letterSpacing: '0.5px' 
                          }}>
                            {trans.transaction_reference}
                          </code>
                          <button
                            onClick={() => copyToClipboard(trans.transaction_reference)}
                            title="Copy Reference"
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                          >
                            {copiedRef === trans.transaction_reference ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                      )}
                      {trans?.bank_name && (
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                          {trans.bank_name}
                        </div>
                      )}
                    </td>

                    {/* Items */}
                    <td style={{ padding: '12px 14px', maxWidth: '160px' }}>
                      <div 
                        style={{ fontSize: '0.8rem', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title={(order.order_items || []).map(i => `${i.quantity}x ${i.menu_items?.name || 'Item'}`).join(', ')}
                      >
                        {(order.order_items || []).length > 0 
                          ? (order.order_items || []).map(i => `${i.quantity}x ${i.menu_items?.name || 'Item'}`).join(', ') 
                          : 'Direct Dine-in'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>
                        {(order.order_items || []).reduce((sum, i) => sum + (Number(i.quantity) || 1), 0)} items total
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                        LKR {Number(order.total_amount).toFixed(2)}
                      </div>
                    </td>

                    {/* Slip Preview Thumbnail */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {trans?.slip_url ? (
                        <button
                          onClick={() => {
                            setActiveModalOrder(order);
                            setZoomLevel(1);
                            setRotation(0);
                          }}
                          style={{
                            padding: '4px 9px',
                            fontSize: '0.76rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            color: '#d97706',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            borderRadius: '6px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Eye size={12} /> View Slip
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>No slip</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {isPending && (
                        <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                          PENDING
                        </span>
                      )}
                      {isRejected && (
                        <div>
                          <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                            REJECTED
                          </span>
                          {trans?.rejection_reason && (
                            <div style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: '2px', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={trans.rejection_reason}>
                              {trans.rejection_reason}
                            </div>
                          )}
                        </div>
                      )}
                      {isApproved && (
                        <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                          APPROVED
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isPending ? (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => handleApprove(order.id)}
                            disabled={isProcessing}
                            title="Verify & Release to Kitchen"
                            style={{
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 1px 2px rgba(16, 185, 129, 0.2)'
                            }}
                          >
                            <CheckCircle2 size={12} /> Approve
                          </button>
                          <button
                            onClick={() => {
                              setRejectingOrder(order);
                              setRejectionReason('');
                            }}
                            disabled={isProcessing}
                            title="Reject Slip"
                            style={{
                              background: 'transparent',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.76rem', color: isApproved ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                          {isApproved ? 'Verified ✓' : 'Rejected ✕'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ============================================================================== */}
      {/* Lightbox Modal: Slip Zoom, Rotate & Side-by-Side Review Pane */}
      {/* ============================================================================== */}
      {activeModalOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div style={{
            background: 'var(--card-bg, #1a1a1a)',
            border: '1px solid var(--border-color, #333)',
            borderRadius: '12px',
            width: '95vw',
            maxWidth: '1100px',
            height: '88vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Topbar */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color, #333)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  Slip Inspection — Order #{activeModalOrder.id}
                </span>
                <span style={{ background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                  BANK TRANSFER
                </span>
              </div>
              <button
                onClick={() => setActiveModalOrder(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Split Screen */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left: Interactive Slip Image Viewer */}
              <div style={{
                flex: 1.2,
                background: '#0a0a0a',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {/* Image Toolbar Floating */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  zIndex: 10,
                  display: 'flex',
                  gap: '8px',
                  background: 'rgba(0,0,0,0.75)',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                    title="Zoom In"
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                    title="Zoom Out"
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                    title="Rotate 90°"
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <RotateCw size={18} />
                  </button>
                  <button
                    onClick={() => { setZoomLevel(1); setRotation(0); }}
                    title="Reset View"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0 4px' }}
                  >
                    Reset
                  </button>
                </div>

                {/* The Slip Image */}
                {activeModalOrder.payment_transaction?.slip_url ? (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'auto',
                    padding: '20px'
                  }}>
                    <img
                      src={activeModalOrder.payment_transaction.slip_url}
                      alt="Bank Transfer Slip"
                      style={{
                        maxWidth: '90%',
                        maxHeight: '90%',
                        objectFit: 'contain',
                        transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)' }}>No slip image available</div>
                )}
              </div>

              {/* Right: Verification Details & Action Pane */}
              <div style={{
                flex: 0.9,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: '1px solid var(--border-color, #333)',
                background: 'var(--card-bg, #1a1a1a)',
                overflowY: 'auto'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    Payment Verification Checklist
                  </h3>

                  {/* Reference Comparison */}
                  <div style={{ marginBottom: '16px', background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Bank / Transaction Reference
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <code style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.5px' }}>
                        {activeModalOrder.payment_transaction?.transaction_reference || 'N/A'}
                      </code>
                      <button
                        onClick={() => copyToClipboard(activeModalOrder.payment_transaction?.transaction_reference)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        title="Copy"
                      >
                        {copiedRef === activeModalOrder.payment_transaction?.transaction_reference ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      </button>
                    </div>
                    {activeModalOrder.payment_transaction?.bank_name && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Bank: <strong>{activeModalOrder.payment_transaction.bank_name}</strong>
                      </div>
                    )}
                  </div>

                  {/* Required Amount */}
                  <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', textTransform: 'uppercase', fontWeight: 600 }}>
                      Total Amount Required
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                      LKR {Number(activeModalOrder.total_amount).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Check if receipt shows exact or greater amount.
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                      Customer Details
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {activeModalOrder.users?.full_name || 'Guest User'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {activeModalOrder.users?.phone_number || activeModalOrder.users?.email || 'N/A'}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                      Items Reserved ({activeModalOrder.order_items?.length || 0})
                    </div>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                      {(activeModalOrder.order_items || []).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span>{item.quantity}x {item.menu_items?.name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>LKR {(item.quantity * item.unit_price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Approve / Reject Buttons */}
                <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => {
                      setRejectingOrder(activeModalOrder);
                      setRejectionReason('');
                    }}
                    disabled={isProcessing}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <XCircle size={18} /> Reject Slip
                  </button>

                  <button
                    onClick={() => handleApprove(activeModalOrder.id)}
                    disabled={isProcessing}
                    style={{
                      flex: 1.5,
                      padding: '12px',
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <CheckCircle2 size={18} /> Verify & Release to Kitchen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* Rejection Reason Modal */}
      {/* ============================================================================== */}
      {rejectingOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div style={{
            background: 'var(--card-bg, #1e1e1e)',
            border: '1px solid var(--border-color, #333)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', color: '#ef4444' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  Reject Payment for Order #{rejectingOrder.id}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  The customer will be notified via push alert and allowed to re-upload a valid slip.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                Select a standard reason:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {CANNED_REASONS.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setRejectionReason(r)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: rejectionReason === r ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: rejectionReason === r ? '1px solid #ef4444' : '1px solid var(--border-color)',
                      color: rejectionReason === r ? '#ef4444' : 'var(--text-primary)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    • {r}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Or enter a custom message:
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain clearly why this payment slip cannot be verified..."
                rows={3}
                style={{ 
                  width: '100%', 
                  fontSize: '0.85rem',
                  padding: '10px 14px',
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#ef4444';
                  e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setRejectingOrder(null);
                  setRejectionReason('');
                }}
                className="btn btn-secondary"
                disabled={isProcessing}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={isProcessing || !rejectionReason.trim()}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  opacity: (!rejectionReason.trim() || isProcessing) ? 0.5 : 1
                }}
              >
                {isProcessing ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
