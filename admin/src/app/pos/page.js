"use client";
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Receipt, 
  CreditCard, 
  Banknote, 
  Printer, 
  Bell, 
  CheckCircle, 
  Lock, 
  Unlock, 
  User, 
  RefreshCw,
  Percent
} from 'lucide-react';

export default function PosBillingPage() {
  const [tables, setTables] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [userRole, setUserRole] = useState('cashier');

  // Settlement Form State
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [cashTendered, setCashTendered] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lockStatus, setLockStatus] = useState({ locked: false, message: '' });

  const printAreaRef = useRef(null);

  async function loadData() {
    try {
      // 1. Fetch tables with unpaid active orders
      const res = await fetch('http://localhost:3000/api/pos/active-tables');
      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }

      // 2. Fetch service requests
      const sRes = await fetch('http://localhost:3000/api/service-requests');
      if (sRes.ok) {
        const sData = await sRes.json();
        setServiceRequests(sData);
      }

      // 3. User role
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const rRes = await fetch('http://localhost:3000/api/admin/my-role', {
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

    // Realtime subscriptions for orders and service requests
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
      // Try to acquire concurrent-access lock
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(`http://localhost:3000/api/pos/orders/${activeOrder.id}/lock`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            setLockStatus({ locked: true, message: '🔒 Bill lock secured for your session' });
          } else {
            const err = await res.json();
            setLockStatus({ locked: false, message: `⚠️ ${err.error || 'Concurrent access notice'}` });
          }
        }
      } catch (e) {
        setLockStatus({ locked: false, message: 'Offline mode' });
      }
    }
  }

  async function handleSettleBill() {
    if (!selectedOrder) return;
    setIsProcessing(true);

    // Enforce role authorization on discounts
    if (discountPercent > 10 && userRole === 'cashier') {
      if (managerPin !== '1234') { // Configurable PIN
        alert('Discounts over 10% require valid Manager authorization PIN!');
        setIsProcessing(false);
        return;
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const baseSubtotal = parseFloat(selectedOrder.subtotal || selectedOrder.total_amount || 0);
      const discountAmount = Math.round((baseSubtotal * (discountPercent / 100)) * 100) / 100;

      const res = await fetch(`http://localhost:3000/api/pos/orders/${selectedOrder.id}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
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
        alert(`Settlement failed: ${err.error}`);
      }
    } catch (e) {
      alert(`Error settling bill: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleAttendServiceRequest(id) {
    try {
      await fetch(`http://localhost:3000/api/service-requests/${id}/attend`, {
        method: 'PATCH'
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  function handlePrintReceipt() {
    window.print();
  }

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading Cashier POS & Billing...</div>;
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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden !important; }
          #pos-receipt-print, #pos-receipt-print * { visibility: visible !important; }
          #pos-receipt-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            color: #000 !important;
            background: #fff !important;
            padding: 10px !important;
            font-family: monospace !important;
          }
        }
      `}} />

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Receipt size={30} color="var(--primary-gold)" />
            Cashier POS & Table Settlement
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Manage active dine-in table checks, apply authorized discounts, accept payments, and print receipts.
          </p>
        </div>
        <button 
          onClick={loadData}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-light)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Service Requests Live Bar */}
      {serviceRequests.length > 0 && (
        <div style={{
          marginBottom: '24px',
          padding: '16px 20px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 'bold' }}>
            <Bell size={20} />
            Table Requests ({serviceRequests.length}):
          </div>
          <div style={{ display: 'flex', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
            {serviceRequests.map(req => (
              <div key={req.id} style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '8px 14px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px'
              }}>
                <span><strong>Table #{req.restaurant_tables?.table_number || req.table_id}</strong>: {req.request_type.replace('_', ' ').toUpperCase()}</span>
                <button
                  onClick={() => handleAttendServiceRequest(req.id)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#22c55e',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                >
                  Attend
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
        {tables.map(t => {
          const hasActiveOrders = t.activeOrders && t.activeOrders.length > 0;
          const isOccupied = t.status === 'occupied' || hasActiveOrders;

          return (
            <div 
              key={t.id}
              onClick={() => isOccupied && handleSelectTable(t)}
              style={{
                background: isOccupied ? 'rgba(212, 175, 55, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `2px solid ${isOccupied ? 'var(--primary-gold)' : 'var(--border-color)'}`,
                borderRadius: '18px',
                padding: '20px',
                cursor: isOccupied ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: isOccupied ? '0 8px 24px rgba(212, 175, 55, 0.15)' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-light)' }}>
                  Table #{t.table_number}
                </span>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  background: isOccupied ? 'rgba(212, 175, 55, 0.2)' : 'rgba(34, 197, 94, 0.15)',
                  color: isOccupied ? 'var(--primary-gold)' : '#22c55e'
                }}>
                  {isOccupied ? 'Occupied' : t.status.toUpperCase()}
                </span>
              </div>

              <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
                Capacity: {t.capacity} Guests
              </div>

              {hasActiveOrders ? (
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Running Total:</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--primary-gold)' }}>
                    LKR {t.runningTotal.toFixed(2)}
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={14} /> Click to Settle Check
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', marginTop: '16px' }}>
                  No active unpaid orders
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bill Settlement Modal */}
      {selectedTable && selectedOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#18181b',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '30px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--text-light)', fontSize: '22px' }}>
                  Settle Bill: Table #{selectedTable.table_number}
                </h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                  Order ID: {selectedOrder.id.substring(0, 8)} • Guest: {selectedOrder.users?.full_name || 'Dine-in Customer'}
                </div>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            {/* Lock Status Banner */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: lockStatus.locked ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
              color: lockStatus.locked ? '#22c55e' : '#eab308',
              fontSize: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {lockStatus.locked ? <Lock size={16} /> : <Unlock size={16} />}
              {lockStatus.message}
            </div>

            {/* Itemized Order List */}
            <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-light)' }}>Order Items:</div>
              {(selectedOrder.order_items || []).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '14px' }}>
                  <span>{item.quantity}x {item.menu_items?.name || 'Item'}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-light)' }}>
                    LKR {(item.quantity * parseFloat(item.unit_price)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Discount & Role Check */}
            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-light)' }}>
                  Apply Discount (%):
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[0, 5, 10, 15, 20].map(p => (
                    <button
                      key={p}
                      onClick={() => setDiscountPercent(p)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: discountPercent === p ? 'var(--primary-gold)' : 'transparent',
                        color: discountPercent === p ? '#000' : 'var(--text-light)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              {discountPercent > 10 && userRole === 'cashier' && (
                <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}>
                    ⚠️ Over 10% requires Manager Authorization PIN:
                  </div>
                  <input
                    type="password"
                    placeholder="Enter Manager PIN (1234)"
                    value={managerPin}
                    onChange={e => setManagerPin(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#000',
                      color: '#fff',
                      border: '1px solid #ef4444'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Payment Method Toggle */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-light)' }}>Select Payment Method:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <button
                  onClick={() => setPaymentMethod('cash')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: `2px solid ${paymentMethod === 'cash' ? 'var(--primary-gold)' : 'var(--border-color)'}`,
                    background: paymentMethod === 'cash' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    color: 'var(--text-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  <Banknote size={18} color="var(--primary-gold)" /> Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: `2px solid ${paymentMethod === 'card' ? 'var(--primary-gold)' : 'var(--border-color)'}`,
                    background: paymentMethod === 'card' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    color: 'var(--text-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  <CreditCard size={18} color="var(--primary-gold)" /> Card
                </button>
                <button
                  onClick={() => setPaymentMethod('online')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: `2px solid ${paymentMethod === 'online' ? 'var(--primary-gold)' : 'var(--border-color)'}`,
                    background: paymentMethod === 'online' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    color: 'var(--text-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  <CheckCircle size={18} color="var(--primary-gold)" /> Online Paid
                </button>
              </div>
            </div>

            {/* Cash Tendered & Change Calculator */}
            {paymentMethod === 'cash' && (
              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Cash Received (LKR):
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={cashTendered}
                      onChange={e => setCashTendered(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: '#09090b',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-light)',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Change Due (LKR):
                    </label>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(34, 197, 94, 0.1)',
                      color: '#22c55e',
                      fontSize: '18px',
                      fontWeight: 'bold'
                    }}>
                      LKR {changeDue.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bill Summary Breakdown */}
            <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '14px', marginBottom: '6px' }}>
                <span>Subtotal:</span>
                <span>LKR {subtotal.toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#22c55e', fontSize: '14px', marginBottom: '6px' }}>
                  <span>Discount ({discountPercent}%):</span>
                  <span>-LKR {discountVal.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '14px', marginBottom: '6px' }}>
                <span>Service Charge (10%):</span>
                <span>LKR {serviceCharge.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '14px', marginBottom: '12px' }}>
                <span>VAT / Tax (8%):</span>
                <span>LKR {taxAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary-gold)', fontSize: '24px', fontWeight: 'bold' }}>
                <span>Total Amount:</span>
                <span>LKR {finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '14px' }}>
              <button
                onClick={handlePrintReceipt}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-light)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Printer size={18} /> Print Receipt
              </button>

              <button
                onClick={handleSettleBill}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  padding: '16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--primary-gold)',
                  color: '#000',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px'
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
            <h2 style={{ margin: '0 0 4px 0' }}>TABLEFLOW RESTAURANT</h2>
            <p style={{ margin: 0, fontSize: '12px' }}>Dine-In Guest Receipt</p>
            <p style={{ margin: 0, fontSize: '11px' }}>Date: {new Date().toLocaleString()}</p>
          </div>
          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />
          <div>
            <p style={{ margin: '2px 0' }}>Table: #{selectedTable.table_number}</p>
            <p style={{ margin: '2px 0' }}>Order ID: #{selectedOrder.id.substring(0, 8)}</p>
            <p style={{ margin: '2px 0' }}>Cashier: {userRole.toUpperCase()}</p>
          </div>
          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />
          <table style={{ width: '100%', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th style={{ textAlign: 'right' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {(selectedOrder.order_items || []).map((i, idx) => (
                <tr key={idx}>
                  <td>{i.menu_items?.name || 'Item'}</td>
                  <td>{i.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{(i.quantity * parseFloat(i.unit_price)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />
          <div style={{ fontSize: '12px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '6px' }}>
              <span>TOTAL PAID:</span>
              <span>LKR {finalTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span>Method:</span>
              <span>{paymentMethod.toUpperCase()}</span>
            </div>
          </div>
          <div style={{ borderBottom: '1px dashed #000', margin: '12px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '11px' }}>
            Thank you for dining with us!<br />
            Powered by TableFlow
          </div>
        </div>
      )}
    </div>
  );
}
