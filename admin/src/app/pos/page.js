"use client";
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Receipt, 
  CreditCard, 
  Banknote, 
  Printer, 
  Bell, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  User, 
  RefreshCw,
  Percent,
  Sparkles,
  AlertCircle,
  Clock,
  X,
  Check
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function PosBillingPage() {
  const [tables, setTables] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [userRole, setUserRole] = useState('cashier');
  const [filterMode, setFilterMode] = useState('active'); // 'all' | 'active' | 'available' | 'cleaning'

  // Settlement Form State
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [cashTendered, setCashTendered] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lockStatus, setLockStatus] = useState({ locked: false, message: '' });

  async function loadData() {
    try {
      // 1. Fetch tables with active orders
      const res = await fetch(`${API_BASE}/api/pos/active-tables`);
      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }

      // 2. Fetch service requests
      const sRes = await fetch(`${API_BASE}/api/service-requests`);
      if (sRes.ok) {
        const sData = await sRes.json();
        setServiceRequests(sData);
      }

      // 3. User role
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const rRes = await fetch(`${API_BASE}/api/admin/my-role`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (rRes.ok) {
          const rData = await rRes.json();
          setUserRole(rData.role || 'cashier');
        }
      }
    } catch (e) {
      console.error('POS data load error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    // Realtime subscriptions for orders, tables, and service requests
    const channel = supabase.channel('pos-realtime-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleSelectTable(table) {
    setSelectedTable(table);
    setDiscountPercent(0);
    setCashTendered('');
    setManagerPin('');

    const activeOrder = table.activeOrders?.[0] || null;
    setSelectedOrder(activeOrder);

    if (activeOrder) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(`${API_BASE}/api/pos/orders/${activeOrder.id}/lock`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            setLockStatus({ locked: true, message: 'Bill secured for your cashier session' });
          } else {
            const err = await res.json();
            setLockStatus({ locked: false, message: err.error || 'Concurrent access notice' });
          }
        } else {
          setLockStatus({ locked: true, message: 'Ready for settlement' });
        }
      } catch (e) {
        setLockStatus({ locked: true, message: 'Local settlement mode' });
      }
    }
  }

  async function handleSettleBill() {
    if (!selectedOrder) return;
    setIsProcessing(true);

    // Enforce role authorization on discounts > 10%
    if (discountPercent > 10 && userRole === 'cashier') {
      if (managerPin !== '1234') {
        alert('Discounts over 10% require valid Manager authorization PIN (1234)!');
        setIsProcessing(false);
        return;
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const baseSubtotal = parseFloat(selectedOrder.subtotal || selectedOrder.total_amount || 0);
      const discountAmount = Math.round((baseSubtotal * (discountPercent / 100)) * 100) / 100;

      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_BASE}/api/pos/orders/${selectedOrder.id}/settle`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          payment_method: paymentMethod,
          discount_amount: discountAmount,
          table_id: selectedTable.id
        })
      });

      if (res.ok) {
        alert(`Bill for Table #${selectedTable.table_number} settled successfully! Table marked for cleaning.`);
        setSelectedTable(null);
        setSelectedOrder(null);
        loadData();
      } else {
        const err = await res.json();
        alert(`Settlement failed: ${err.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`Error settling bill: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleMarkCleaned(tableId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      await fetch(`${API_BASE}/api/tables/${tableId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'available' })
      });
      loadData();
    } catch (e) {
      console.error('Error clearing table:', e);
    }
  }

  async function handleAttendServiceRequest(id) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      await fetch(`${API_BASE}/api/service-requests/${id}/attend`, {
        method: 'PATCH',
        headers
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  function handlePrintReceipt() {
    window.print();
  }

  // Calculations for bill modal
  const subtotal = selectedOrder ? parseFloat(selectedOrder.subtotal || selectedOrder.total_amount || 0) : 0;
  const discountVal = (subtotal * (discountPercent / 100));
  const postDiscount = Math.max(0, subtotal - discountVal);
  const serviceCharge = (postDiscount * 0.10);
  const taxAmount = (postDiscount * 0.08);
  const finalTotal = (postDiscount + serviceCharge + taxAmount);
  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedNum - finalTotal);

  // Filtered tables
  const filteredTables = tables.filter(t => {
    const hasActive = t.activeOrders && t.activeOrders.length > 0;
    if (filterMode === 'active') return hasActive;
    if (filterMode === 'available') return t.status === 'available' && !hasActive;
    if (filterMode === 'cleaning') return t.status === 'cleaning';
    return true;
  });

  // KPI Metrics
  const activeChecksCount = tables.filter(t => t.activeOrders && t.activeOrders.length > 0).length;
  const totalUnsettledLKR = tables.reduce((sum, t) => sum + (Number(t.runningTotal) || 0), 0);
  const cleaningCount = tables.filter(t => t.status === 'cleaning').length;

  if (loading && tables.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
        <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
        <p style={{ fontSize: '16px' }}>Loading Cashier POS & Floor Tables...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Print Styles for 80mm Thermal Receipt */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden !important; }
          #pos-receipt-print, #pos-receipt-print * { visibility: visible !important; }
          #pos-receipt-print {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            color: #000 !important;
            background: #fff !important;
            padding: 10px !important;
            font-family: monospace !important;
            font-size: 12px !important;
            z-index: 999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: '700' }}>
              Cashier POS & Table Settlement
            </h1>
            <span style={{ fontSize: '12px', background: 'rgba(184, 127, 92, 0.12)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
              Register Active
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Manage active dine-in table checks, apply authorized discounts, accept payments, and print receipts.
          </p>
        </div>

        <button 
          onClick={loadData}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px' }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Floor Status Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="data-card" style={{ padding: '16px 20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Unsettled Checks</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--primary)', marginTop: '4px' }}>
            {activeChecksCount} <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>tables</span>
          </div>
        </div>

        <div className="data-card" style={{ padding: '16px 20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Running Tab</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px' }}>
            LKR {totalUnsettledLKR.toLocaleString()}
          </div>
        </div>

        <div className="data-card" style={{ padding: '16px 20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tables to Clean</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#f59e0b', marginTop: '4px' }}>
            {cleaningCount} <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>tables</span>
          </div>
        </div>

        <div className="data-card" style={{ padding: '16px 20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cashier Session</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '6px', textTransform: 'capitalize' }}>
            {userRole}
          </div>
        </div>
      </div>

      {/* Service Requests Live Alert Bar */}
      {serviceRequests.filter(r => r.status === 'pending').length > 0 && (
        <div style={{
          marginBottom: '24px',
          padding: '14px 18px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: '700', fontSize: '14px' }}>
            <Bell size={18} />
            <span>Active Service Calls ({serviceRequests.filter(r => r.status === 'pending').length}):</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
            {serviceRequests.filter(r => r.status === 'pending').map(req => (
              <div key={req.id} style={{
                background: '#ffffff',
                border: '1px solid #fecaca',
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                <span><strong>Table #{req.restaurant_tables?.table_number || req.table_id}</strong>: {req.request_type.replace('_', ' ').toUpperCase()}</span>
                <button
                  onClick={() => handleAttendServiceRequest(req.id)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#10b981',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}
                >
                  Attend
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { key: 'active', label: `Active Checks (${activeChecksCount})` },
          { key: 'all', label: `All Tables (${tables.length})` },
          { key: 'available', label: `Available (${tables.filter(t => t.status === 'available' && (!t.activeOrders || t.activeOrders.length === 0)).length})` },
          { key: 'cleaning', label: `Needs Cleaning (${cleaningCount})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterMode(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: filterMode === tab.key ? '600' : '500',
              border: filterMode === tab.key ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: filterMode === tab.key ? 'var(--primary)' : 'var(--bg-card)',
              color: filterMode === tab.key ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Grid */}
      {filteredTables.length === 0 ? (
        <div className="data-card" style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <CheckCircle2 size={40} color="var(--primary)" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>No Tables in this Category</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            {filterMode === 'active' ? 'All dining checks are settled. Floor is clear!' : 'Select "All Tables" to inspect full floor layout.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
          {filteredTables.map(t => {
            const hasActiveOrders = t.activeOrders && t.activeOrders.length > 0;
            const isOccupied = hasActiveOrders;
            const isCleaning = t.status === 'cleaning';

            return (
              <div 
                key={t.id}
                onClick={() => hasActiveOrders && handleSelectTable(t)}
                style={{
                  background: 'var(--bg-card)',
                  border: hasActiveOrders ? '2px solid var(--primary)' : (isCleaning ? '1px solid #fde68a' : '1px solid var(--border)'),
                  borderRadius: '14px',
                  padding: '18px',
                  cursor: hasActiveOrders ? 'pointer' : 'default',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: hasActiveOrders ? '0 6px 16px rgba(184, 127, 92, 0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '190px'
                }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Table #{t.table_number}
                    </span>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: hasActiveOrders ? 'rgba(184, 127, 92, 0.12)' : (isCleaning ? '#fef3c7' : 'rgba(16, 185, 129, 0.1)'),
                      color: hasActiveOrders ? 'var(--primary)' : (isCleaning ? '#d97706' : '#10b981')
                    }}>
                      {hasActiveOrders ? 'CHECK OPEN' : (isCleaning ? 'CLEANING' : 'AVAILABLE')}
                    </span>
                  </div>

                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>
                    Capacity: {t.capacity} Guests • {t.status}
                  </div>

                  {/* Active Orders Info */}
                  {hasActiveOrders ? (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Running Total
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)', marginTop: '2px' }}>
                        LKR {Number(t.runningTotal).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Guest: <strong>{t.activeOrders[0]?.users?.full_name || 'Dine-in Guest'}</strong>
                      </div>
                    </div>
                  ) : isCleaning ? (
                    <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '12px', color: '#b45309' }}>
                      Table needs cleaning before next party
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', marginTop: '14px' }}>
                      Ready for guests
                    </div>
                  )}
                </div>

                {/* Bottom Action */}
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  {hasActiveOrders ? (
                    <div style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Settle Check</span>
                      <span>→</span>
                    </div>
                  ) : isCleaning ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkCleaned(t.id); }}
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '6px', fontSize: '12px', fontWeight: '600' }}
                    >
                      Mark Cleaned / Available
                    </button>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={14} /> Available
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bill Settlement Modal */}
      {selectedTable && selectedOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
            fontFamily: 'var(--font-body)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Settle Bill: Table #{selectedTable.table_number}
                </h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                  Order #{selectedOrder.id.substring(0, 8)} • Guest: <strong>{selectedOrder.users?.full_name || 'Dine-in Customer'}</strong>
                </div>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Lock Status Banner */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: lockStatus.locked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              color: lockStatus.locked ? '#059669' : '#d97706',
              fontSize: '12px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600'
            }}>
              {lockStatus.locked ? <Lock size={15} /> : <Unlock size={15} />}
              <span>{lockStatus.message}</span>
            </div>

            {/* Itemized Order List */}
            <div style={{ marginBottom: '20px', background: 'var(--bg-surface)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '10px', color: 'var(--text-primary)' }}>Line Items on Check:</div>
              {(selectedOrder.order_items || []).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {item.quantity}x {item.menu_items?.name || 'Item'}
                  </span>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    LKR {(item.quantity * parseFloat(item.unit_price)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Discount & Role Check */}
            <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Apply Discount:
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0, 5, 10, 15, 20].map(p => (
                    <button
                      key={p}
                      onClick={() => setDiscountPercent(p)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: discountPercent === p ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: discountPercent === p ? 'var(--primary)' : '#ffffff',
                        color: discountPercent === p ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '12px'
                      }}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              {discountPercent > 10 && userRole === 'cashier' && (
                <div style={{ marginTop: '12px', padding: '10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '6px', fontWeight: '700' }}>
                    ⚠️ Over 10% requires Manager Authorization PIN:
                  </div>
                  <input
                    type="password"
                    placeholder="Enter Manager PIN (1234)"
                    value={managerPin}
                    onChange={e => setManagerPin(e.target.value)}
                    className="input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
              )}
            </div>

            {/* Payment Method Toggle */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', color: 'var(--text-primary)' }}>Select Tender Method:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <button
                  onClick={() => setPaymentMethod('cash')}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: paymentMethod === 'cash' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: paymentMethod === 'cash' ? 'rgba(184, 127, 92, 0.08)' : '#ffffff',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '13px'
                  }}
                >
                  <Banknote size={16} color="var(--primary)" /> Cash
                </button>

                <button
                  onClick={() => setPaymentMethod('card')}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: paymentMethod === 'card' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: paymentMethod === 'card' ? 'rgba(184, 127, 92, 0.08)' : '#ffffff',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '13px'
                  }}
                >
                  <CreditCard size={16} color="var(--primary)" /> Card (POS)
                </button>

                <button
                  onClick={() => setPaymentMethod('online')}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: paymentMethod === 'online' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: paymentMethod === 'online' ? 'rgba(184, 127, 92, 0.08)' : '#ffffff',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '13px'
                  }}
                >
                  <CheckCircle2 size={16} color="var(--primary)" /> Online Paid
                </button>
              </div>
            </div>

            {/* Cash Tendered & Change Calculator */}
            {paymentMethod === 'cash' && (
              <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Cash Received (LKR):
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={cashTendered}
                      onChange={e => setCashTendered(e.target.value)}
                      className="input"
                      style={{ fontSize: '15px', fontWeight: '700' }}
                    />
                    {/* Quick amount shortcuts */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {[finalTotal, Math.ceil(finalTotal / 1000) * 1000, 5000, 10000].filter((v, i, a) => a.indexOf(v) === i && v >= finalTotal).map(amt => (
                        <button
                          key={amt}
                          onClick={() => setCashTendered(String(amt))}
                          style={{
                            padding: '2px 6px',
                            fontSize: '11px',
                            background: '#ffffff',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          LKR {amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Change Due (LKR):
                    </label>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#059669',
                      fontSize: '18px',
                      fontWeight: '800'
                    }}>
                      LKR {changeDue.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bill Summary Breakdown */}
            <div style={{ marginBottom: '22px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>
                <span>Subtotal:</span>
                <span>LKR {subtotal.toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontSize: '13px', marginBottom: '6px' }}>
                  <span>Discount ({discountPercent}%):</span>
                  <span>-LKR {discountVal.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>
                <span>Service Charge (10%):</span>
                <span>LKR {serviceCharge.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '10px' }}>
                <span>VAT / Tax (8%):</span>
                <span>LKR {taxAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontSize: '22px', fontWeight: '800', borderTop: '2px solid var(--border)', paddingTop: '10px' }}>
                <span>Total Amount:</span>
                <span style={{ color: 'var(--primary)' }}>LKR {finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handlePrintReceipt}
                className="btn btn-secondary"
                style={{
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '600'
                }}
              >
                <Printer size={16} /> Print Receipt
              </button>

              <button
                onClick={handleSettleBill}
                disabled={isProcessing}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: '14px',
                  fontWeight: '700',
                  fontSize: '15px'
                }}
              >
                {isProcessing ? 'Settling...' : 'Confirm Settle & Free Table'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Thermal Receipt Print View */}
      {selectedTable && selectedOrder && (
        <div id="pos-receipt-print" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>TABLEFLOW BOUTIQUE</h2>
            <p style={{ margin: 0, fontSize: '11px' }}>Dine-In Guest Receipt</p>
            <p style={{ margin: 0, fontSize: '10px' }}>Date: {new Date().toLocaleString()}</p>
          </div>
          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />
          <div style={{ fontSize: '11px' }}>
            <p style={{ margin: '2px 0' }}>Table: #{selectedTable.table_number}</p>
            <p style={{ margin: '2px 0' }}>Order ID: #{selectedOrder.id.substring(0, 8)}</p>
            <p style={{ margin: '2px 0' }}>Cashier: {userRole.toUpperCase()}</p>
          </div>
          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />
          <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ padding: '2px 0' }}>Item</th>
                <th style={{ padding: '2px 0' }}>Qty</th>
                <th style={{ padding: '2px 0', textAlign: 'right' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {(selectedOrder.order_items || []).map((i, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '3px 0' }}>{i.menu_items?.name || 'Item'}</td>
                  <td style={{ padding: '3px 0' }}>{i.quantity}</td>
                  <td style={{ padding: '3px 0', textAlign: 'right' }}>{(i.quantity * parseFloat(i.unit_price)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />
          <div style={{ fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>LKR {subtotal.toFixed(2)}</span>
            </div>
            {discountPercent > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount ({discountPercent}%):</span>
                <span>-LKR {discountVal.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Service Charge (10%):</span>
              <span>LKR {serviceCharge.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>VAT / Tax (8%):</span>
              <span>LKR {taxAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginTop: '6px' }}>
              <span>TOTAL PAID:</span>
              <span>LKR {finalTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span>Method:</span>
              <span>{paymentMethod.toUpperCase()}</span>
            </div>
          </div>
          <div style={{ borderBottom: '1px dashed #000', margin: '12px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '10px' }}>
            Thank you for dining with us!<br />
            Powered by TableFlow
          </div>
        </div>
      )}
    </div>
  );
}
