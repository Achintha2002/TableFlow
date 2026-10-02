"use client";
import { useEffect, useState, useMemo } from 'react';
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
  Check,
  Search,
  Users,
  ChevronRight,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function PosBillingPage() {
  const [tables, setTables] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [settleMode, setSettleMode] = useState('table'); // 'table' | 'order'
  const [userRole, setUserRole] = useState('cashier');
  const [filterMode, setFilterMode] = useState('active'); // 'all' | 'active' | 'available' | 'cleaning'
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Settlement Form State
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [cashTendered, setCashTendered] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lockStatus, setLockStatus] = useState({ locked: false, message: '' });

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  }

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
    setSettleMode('table');

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
            setLockStatus({ locked: true, message: 'Table check secured for your cashier session' });
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
    if (!selectedTable) return;
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
      const isTableCheck = settleMode === 'table';
      const baseSubtotal = isTableCheck
        ? parseFloat(selectedTable.runningTotal || 0)
        : parseFloat(selectedOrder?.subtotal || selectedOrder?.total_amount || 0);
      const discountAmount = Math.round((baseSubtotal * (discountPercent / 100)) * 100) / 100;

      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const endpoint = isTableCheck
        ? `${API_BASE}/api/pos/tables/${selectedTable.id}/settle`
        : `${API_BASE}/api/pos/orders/${selectedOrder.id}/settle`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          payment_method: paymentMethod,
          discount_amount: discountAmount,
          table_id: selectedTable.id
        })
      });

      if (res.ok) {
        showToast(`🎉 Bill for Table #${selectedTable.table_number} settled successfully!`);
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

  async function handleMarkCleaned(tableId, tableNum) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      await fetch(`${API_BASE}/api/tables/${tableId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'available' })
      });
      showToast(`Table #${tableNum} marked as cleaned and ready for guests!`);
      loadData();
    } catch (e) {
      console.error('Error clearing table:', e);
    }
  }

  async function handleAttendServiceRequest(id, tableNum) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      await fetch(`${API_BASE}/api/service-requests/${id}/attend`, {
        method: 'PATCH',
        headers
      });
      showToast(`Attended service call for Table #${tableNum}`);
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  function handlePrintReceipt() {
    const printContent = document.getElementById('pos-receipt-print');
    if (!printContent) {
      alert('Receipt content is not available.');
      return;
    }

    // Remove any previously created print iframe
    const existingIframe = document.getElementById('tableflow-print-frame');
    if (existingIframe) {
      existingIframe.remove();
    }

    // Create an isolated iframe for clean, full-width thermal receipt preview
    const iframe = document.createElement('iframe');
    iframe.id = 'tableflow-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow || iframe.contentDocument;
    const iframeDoc = doc.document || doc;

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - Table #${selectedTable?.table_number}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 4mm 3mm;
            }
            body {
              font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
              width: 74mm;
              margin: 0 auto;
              padding: 4px;
              color: #000000;
              font-size: 12px;
              line-height: 1.35;
              background: #ffffff;
            }
            * {
              box-sizing: border-box;
            }
            h2, h3, p {
              margin: 0;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    // Trigger print after styles and layout have settled in iframe
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Print error:', err);
        window.print();
      }
    }, 250);
  }

  // Calculations for bill modal
  const activeOrdersList = selectedTable?.activeOrders || [];
  const isTableWide = settleMode === 'table';
  const subtotal = isTableWide
    ? parseFloat(selectedTable?.runningTotal || 0)
    : (selectedOrder ? parseFloat(selectedOrder.subtotal || selectedOrder.total_amount || 0) : 0);
  const discountVal = (subtotal * (discountPercent / 100));
  const postDiscount = Math.max(0, subtotal - discountVal);
  const serviceCharge = (postDiscount * 0.10);
  const taxAmount = (postDiscount * 0.08);
  const finalTotal = (postDiscount + serviceCharge + taxAmount);
  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedNum - finalTotal);

  const displayedItems = isTableWide
    ? activeOrdersList.flatMap((o, oIdx) =>
        (o.order_items || []).map(item => ({
          ...item,
          orderIdShort: o.id.substring(0, 8),
          ticketNum: oIdx + 1
        }))
      )
    : (selectedOrder?.order_items || []).map(item => ({
        ...item,
        orderIdShort: selectedOrder.id.substring(0, 8),
        ticketNum: 1
      }));

  // Filtered tables by Mode & Search
  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      const hasActive = t.activeOrders && t.activeOrders.length > 0;
      let matchesMode = true;
      if (filterMode === 'active') matchesMode = hasActive;
      else if (filterMode === 'available') matchesMode = t.status === 'available' && !hasActive;
      else if (filterMode === 'cleaning') matchesMode = t.status === 'cleaning';

      if (!matchesMode) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const numStr = String(t.table_number || '').toLowerCase();
      const guestName = (t.activeOrders?.[0]?.users?.full_name || '').toLowerCase();
      const cat = (t.table_categories?.name || '').toLowerCase();
      return numStr.includes(q) || guestName.includes(q) || cat.includes(q);
    });
  }, [tables, filterMode, searchQuery]);

  // KPI Metrics
  const activeChecksCount = tables.filter(t => t.activeOrders && t.activeOrders.length > 0).length;
  const totalUnsettledLKR = tables.reduce((sum, t) => sum + (Number(t.runningTotal) || 0), 0);
  const cleaningCount = tables.filter(t => t.status === 'cleaning').length;
  const availableCount = tables.filter(t => t.status === 'available' && (!t.activeOrders || t.activeOrders.length === 0)).length;

  if (loading && tables.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-muted)' }}>
        <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 16px', opacity: 0.7, color: 'var(--primary)' }} />
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Connecting to Floor Register...</h3>
        <p style={{ fontSize: '14px', marginTop: '6px' }}>Synchronizing table checks, active orders, and service alerts</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '70px', position: 'relative' }}>
      {/* Print Styles for 80mm Thermal Receipt & Luxury POS Modal Scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* If printed natively, hide layout and force receipt display */
          .admin-layout, .sidebar, .topbar {
            display: none !important;
          }
          #pos-receipt-print {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            color: #000 !important;
            background: #fff !important;
            padding: 8px !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12px !important;
            z-index: 9999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }

        /* ── LUXURY ULTRA-SLEEK POS MODAL SCROLLBAR ── */
        .pos-modal-scroll {
          scrollbar-width: thin !important;
          scrollbar-color: rgba(184, 127, 92, 0.3) transparent !important;
          scroll-behavior: smooth;
        }
        .pos-modal-scroll::-webkit-scrollbar {
          width: 5px !important;
          height: 5px !important;
        }
        .pos-modal-scroll::-webkit-scrollbar-track {
          background: transparent !important;
          margin: 6px 0 !important;
        }
        .pos-modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(184, 127, 92, 0.28) !important;
          border-radius: 99px !important;
        }
        .pos-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(184, 127, 92, 0.6) !important;
        }

        @keyframes modalPopUp {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}} />

      {/* Floating Modern Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '28px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          padding: '14px 22px',
          borderRadius: '14px',
          boxShadow: '0 20px 35px -8px rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px',
          fontWeight: '600',
          animation: 'fadeInSlide 0.3s ease-out'
        }}>
          <CheckCircle2 size={18} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── TOP CONTROL & SEARCH TOOLBAR ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '22px',
        padding: '16px 20px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.9) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
      }}>
        {/* Left: Terminal indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(16, 185, 129, 0.10)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '6px 12px',
            borderRadius: '20px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981'
            }} />
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#047857' }}>
              Terminal Active • Floor Live
            </span>
          </div>

          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Table settlement & cashier ledger
          </span>
        </div>

        {/* Right: Quick Search & Manual Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Quick Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '6px 12px',
            width: '230px',
            transition: 'border 0.2s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Filter Table # or Guest..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                width: '100%',
                background: 'transparent',
                color: 'var(--text-primary)'
              }}
            />
            {searchQuery && (
              <X size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
            )}
          </div>

          {/* Refresh Button */}
          <button 
            onClick={loadData}
            title="Refresh floor state"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid var(--border)',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} color="var(--primary)" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ── 4 LUXURY EXECUTIVE KPI METRIC CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Card 1: Active Open Checks */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #fffbf8 100%)',
          border: '1px solid rgba(184, 127, 92, 0.22)',
          boxShadow: '0 8px 20px -4px rgba(184, 127, 92, 0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Active Unsettled Checks
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'var(--font-serif)', letterSpacing: '-0.5px' }}>
                {activeChecksCount}
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginLeft: '6px', fontFamily: 'var(--font-body)' }}>tables</span>
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(184, 127, 92, 0.15) 0%, rgba(212, 175, 55, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Receipt size={20} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#10b981', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '600' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            <span>Currently dining & ordering</span>
          </div>
        </div>

        {/* Card 2: Total Running Tab */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #faf8f5 100%)',
          border: '1px solid rgba(212, 175, 55, 0.30)',
          boxShadow: '0 8px 20px -4px rgba(212, 175, 55, 0.10)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Total Running Tab (LKR)
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums' }}>
                {totalUnsettledLKR.toLocaleString()}
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.20) 0%, rgba(184, 127, 92, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706'
            }}>
              <Banknote size={20} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>Avg Tab: <strong>LKR {activeChecksCount > 0 ? Math.round(totalUnsettledLKR / activeChecksCount).toLocaleString() : '0'}</strong></span>
          </div>
        </div>

        {/* Card 3: Tables to Clean */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)',
          border: '1px solid rgba(245, 158, 11, 0.22)',
          boxShadow: '0 8px 20px -4px rgba(245, 158, 11, 0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Tables Pending Cleaning
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: cleaningCount > 0 ? '#d97706' : 'var(--text-primary)', marginTop: '6px', fontFamily: 'var(--font-serif)' }}>
                {cleaningCount}
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginLeft: '6px', fontFamily: 'var(--font-body)' }}>tables</span>
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706'
            }}>
              <Sparkles size={20} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: cleaningCount > 0 ? '#d97706' : '#10b981', marginTop: '10px', fontWeight: '600' }}>
            {cleaningCount > 0 ? '⚠️ Action needed for table turnover' : '✨ 100% floor tables ready'}
          </div>
        </div>

        {/* Card 4: Cashier Session */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)',
          border: '1px solid rgba(99, 102, 241, 0.20)',
          boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Cashier Operator
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '6px', textTransform: 'capitalize' }}>
                {userRole}
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4f46e5'
            }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#4f46e5', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
            <Lock size={12} />
            <span>Settlement Security Active</span>
          </div>
        </div>
      </div>

      {/* ── LIVE SERVICE CALLS ALERT BANNER ── */}
      {serviceRequests.filter(r => r.status === 'pending').length > 0 && (
        <div style={{
          marginBottom: '22px',
          padding: '14px 20px',
          background: 'linear-gradient(90deg, #fef2f2 0%, #fff7ed 100%)',
          border: '1px solid #fecaca',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: '800', fontSize: '13px' }}>
            <Bell size={18} className="animate-bounce" />
            <span>GUEST SERVICE REQUESTS ({serviceRequests.filter(r => r.status === 'pending').length}):</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
            {serviceRequests.filter(r => r.status === 'pending').map(req => {
              const tblNum = req.restaurant_tables?.table_number || req.table_id;
              return (
                <div key={req.id} style={{
                  background: '#ffffff',
                  border: '1px solid #fca5a5',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '13px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                }}>
                  <span><strong>Table #{tblNum}</strong>: <span style={{ color: '#b91c1c', fontWeight: '600' }}>{req.request_type.replace('_', ' ').toUpperCase()}</span></span>
                  <button
                    onClick={() => handleAttendServiceRequest(req.id, tblNum)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '700',
                      boxShadow: '0 2px 5px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    Attend
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SEGMENTED FILTER TABS ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '22px', flexWrap: 'wrap' }}>
        {[
          { key: 'active', label: 'Active Checks', count: activeChecksCount, color: 'var(--primary)' },
          { key: 'all', label: 'All Tables', count: tables.length, color: 'var(--text-secondary)' },
          { key: 'available', label: 'Available', count: availableCount, color: '#10b981' },
          { key: 'cleaning', label: 'Needs Cleaning', count: cleaningCount, color: '#f59e0b' }
        ].map(tab => {
          const isActive = filterMode === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilterMode(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: isActive ? '700' : '600',
                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: isActive 
                  ? 'linear-gradient(135deg, var(--primary) 0%, #9c6848 100%)' 
                  : '#ffffff',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: isActive ? '0 4px 12px rgba(184, 127, 92, 0.25)' : '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                color: isActive ? '#ffffff' : tab.color,
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '800'
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── TABLE CARDS GRID ── */}
      {filteredTables.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '70px 24px',
          background: '#ffffff',
          borderRadius: '18px',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
        }}>
          <CheckCircle2 size={44} color="var(--primary)" style={{ margin: '0 auto 14px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>No Tables in this Category</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px', maxWidth: '440px', margin: '6px auto 0' }}>
            {filterMode === 'active' 
              ? 'All dine-in checks have been settled. The restaurant floor is all clear!' 
              : 'Try selecting "All Tables" or clear your search query to inspect the full floor.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
          {filteredTables.map(t => {
            const hasActiveOrders = t.activeOrders && t.activeOrders.length > 0;
            const isCleaning = t.status === 'cleaning';
            const catName = t.table_categories?.name || 'Main Dining';
            const itemsCount = t.activeOrders?.reduce((sum, o) => sum + (o.order_items?.length || 0), 0) || 0;
            const guestName = t.activeOrders?.[0]?.users?.full_name || 'Dine-in Customer';

            return (
              <div 
                key={t.id}
                onClick={() => hasActiveOrders && handleSelectTable(t)}
                style={{
                  background: hasActiveOrders 
                    ? 'linear-gradient(180deg, #ffffff 0%, #fffcf9 100%)' 
                    : (isCleaning ? '#fffdf7' : '#ffffff'),
                  border: hasActiveOrders 
                    ? '1.8px solid rgba(184, 127, 92, 0.45)' 
                    : (isCleaning ? '1.5px solid #fcd34d' : '1px solid var(--border)'),
                  borderRadius: '18px',
                  padding: '22px',
                  cursor: hasActiveOrders ? 'pointer' : 'default',
                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: hasActiveOrders 
                    ? '0 10px 25px -4px rgba(184, 127, 92, 0.14)' 
                    : '0 2px 6px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '230px',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Top Header: Table Number & Status Pill */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                          Table #{t.table_number}
                        </span>
                        {t.table_name && (
                          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)' }}>
                            • {t.table_name}
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={12} /> Capacity: {t.capacity} Guests • {catName}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span style={{
                      padding: '5px 12px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: '800',
                      letterSpacing: '0.4px',
                      background: hasActiveOrders 
                        ? 'rgba(184, 127, 92, 0.14)' 
                        : (isCleaning ? '#fef3c7' : 'rgba(16, 185, 129, 0.12)'),
                      color: hasActiveOrders 
                        ? 'var(--primary)' 
                        : (isCleaning ? '#b45309' : '#059669'),
                      border: hasActiveOrders 
                        ? '1px solid rgba(184, 127, 92, 0.30)' 
                        : (isCleaning ? '1px solid #fde68a' : '1px solid rgba(16, 185, 129, 0.25)'),
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      {hasActiveOrders ? (
                        <>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                          CHECK OPEN
                        </>
                      ) : (isCleaning ? 'CLEANING' : 'AVAILABLE')}
                    </span>
                  </div>

                  {/* Active Orders Info & Total */}
                  {hasActiveOrders ? (
                    <div style={{
                      marginTop: '12px',
                      padding: '14px',
                      background: 'rgba(184, 127, 92, 0.05)',
                      borderRadius: '12px',
                      border: '1px solid rgba(184, 127, 92, 0.15)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          RUNNING TAB
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {t.activeOrders.length} {t.activeOrders.length === 1 ? 'ticket' : 'tickets'} ({itemsCount} items)
                        </span>
                      </div>

                      <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                        LKR {Number(t.runningTotal).toLocaleString()}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} color="var(--primary)" />
                        <span>Guest: <strong style={{ color: 'var(--text-primary)' }}>{guestName}</strong></span>
                      </div>
                    </div>
                  ) : isCleaning ? (
                    <div style={{
                      marginTop: '16px',
                      padding: '14px',
                      background: '#fffbeb',
                      borderRadius: '12px',
                      fontSize: '13px',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Sparkles size={16} />
                      <span>Table turnover required before seating next party.</span>
                    </div>
                  ) : (
                    <div style={{
                      marginTop: '16px',
                      padding: '14px',
                      background: 'rgba(16, 185, 129, 0.04)',
                      borderRadius: '12px',
                      fontSize: '13px',
                      color: '#059669',
                      border: '1px solid rgba(16, 185, 129, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <CheckCircle2 size={16} />
                      <span>Ready for walk-in or reserved guests.</span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div style={{ marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  {hasActiveOrders ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 14px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, var(--primary) 0%, #9c6848 100%)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '700',
                      boxShadow: '0 4px 10px rgba(184, 127, 92, 0.25)'
                    }}>
                      <span>Settle Check</span>
                      <ArrowRight size={16} />
                    </div>
                  ) : isCleaning ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkCleaned(t.id, t.table_number); }}
                      style={{
                        width: '100%',
                        padding: '9px',
                        fontSize: '12px',
                        fontWeight: '700',
                        borderRadius: '10px',
                        border: '1px solid #f59e0b',
                        background: '#fff',
                        color: '#d97706',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Sparkles size={14} />
                      <span>Mark Cleaned / Available</span>
                    </button>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                      <Check size={14} /> <span>Available for Seating</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LUXURY STATE-OF-THE-ART SETTLEMENT MODAL ── */}
      {selectedTable && selectedOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(184, 127, 92, 0.25)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.40)',
            fontFamily: 'var(--font-body)',
            position: 'relative',
            animation: 'modalPopUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* 1. PINNED HEADER */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '22px 28px 16px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              background: '#ffffff',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(184, 127, 92, 0.16) 0%, rgba(212, 175, 55, 0.16) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)'
                }}>
                  <Receipt size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-serif)' }}>
                    Settle Bill: Table #{selectedTable.table_number}
                  </h2>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                    {isTableWide 
                      ? `Consolidated Check (${activeOrdersList.length} Tickets) • Running Tab: LKR ${subtotal.toLocaleString()}` 
                      : `Ticket #${selectedOrder?.id?.substring(0, 8)} • Guest: ${selectedOrder?.users?.full_name || 'Dine-in Customer'}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                <X size={18} />
              </button>
            </div>

            {/* 2. SCROLLABLE CONTENT BODY */}
            <div className="pos-modal-scroll" style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {/* Multi-Ticket Check Scope Selector */}
              {activeOrdersList.length > 1 && (
                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(184, 127, 92, 0.05)',
                  borderRadius: '14px',
                  border: '1px solid rgba(184, 127, 92, 0.18)'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
                    SELECT CHECK SCOPE TO SETTLE:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setSettleMode('table')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: isTableWide ? '700' : '600',
                        background: isTableWide ? 'var(--primary)' : '#ffffff',
                        color: isTableWide ? '#ffffff' : 'var(--text-primary)',
                        border: isTableWide ? '1px solid var(--primary)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        boxShadow: isTableWide ? '0 2px 6px rgba(184, 127, 92, 0.3)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      All Tickets (Table Total: LKR {Number(selectedTable.runningTotal).toLocaleString()})
                    </button>
                    {activeOrdersList.map((o, idx) => (
                      <button
                        key={o.id}
                        onClick={() => {
                          setSettleMode('order');
                          setSelectedOrder(o);
                        }}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: (!isTableWide && selectedOrder?.id === o.id) ? '700' : '600',
                          background: (!isTableWide && selectedOrder?.id === o.id) ? 'var(--primary)' : '#ffffff',
                          color: (!isTableWide && selectedOrder?.id === o.id) ? '#ffffff' : 'var(--text-primary)',
                          border: (!isTableWide && selectedOrder?.id === o.id) ? '1px solid var(--primary)' : '1px solid var(--border)',
                          cursor: 'pointer',
                          boxShadow: (!isTableWide && selectedOrder?.id === o.id) ? '0 2px 6px rgba(184, 127, 92, 0.3)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Ticket #{idx + 1} (LKR {Number(o.total_amount).toLocaleString()})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lock Status Banner */}
              <div style={{
                padding: '9px 14px',
                borderRadius: '10px',
                background: lockStatus.locked ? 'rgba(16, 185, 129, 0.10)' : 'rgba(245, 158, 11, 0.10)',
                color: lockStatus.locked ? '#047857' : '#b45309',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600',
                border: lockStatus.locked ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)'
              }}>
                {lockStatus.locked ? <Lock size={14} /> : <Unlock size={14} />}
                <span>{lockStatus.message}</span>
              </div>

              {/* Itemized Order List Drawer */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '14px',
                padding: '14px 16px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Line Items on Check ({displayedItems.length} items)</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unit Price × Qty</span>
                </div>
                <div className="pos-modal-scroll" style={{ maxHeight: '150px', overflowY: 'auto', paddingRight: '6px' }}>
                  {displayedItems.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '7px 0',
                      borderBottom: idx !== displayedItems.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      fontSize: '13px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isTableWide && activeOrdersList.length > 1 && (
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(184,127,92,0.12)', color: 'var(--primary)', fontWeight: '800' }}>
                            T#{item.ticketNum}
                          </span>
                        )}
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                          {item.quantity}× {item.menu_items?.name || 'Item'}
                        </span>
                      </div>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        LKR {(item.quantity * parseFloat(item.unit_price)).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount & Role Check */}
              <div style={{
                padding: '14px 18px',
                background: '#f8fafc',
                borderRadius: '14px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Percent size={14} color="var(--primary)" />
                    Apply Discount:
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[0, 5, 10, 15, 20].map(p => (
                      <button
                        key={p}
                        onClick={() => setDiscountPercent(p)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: discountPercent === p ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: discountPercent === p ? 'var(--primary)' : '#ffffff',
                          color: discountPercent === p ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: '700',
                          fontSize: '12px',
                          boxShadow: discountPercent === p ? '0 2px 6px rgba(184, 127, 92, 0.25)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {p === 0 ? 'None' : `${p}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {discountPercent > 10 && userRole === 'cashier' && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
                    <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '6px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={14} /> Over 10% requires Manager Authorization PIN:
                    </div>
                    <input
                      type="password"
                      placeholder="Enter Manager PIN (Default: 1234)"
                      value={managerPin}
                      onChange={e => setManagerPin(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        fontSize: '13px',
                        borderRadius: '8px',
                        border: '1px solid #f87171',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Payment Method Tender Selector */}
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Select Payment Tender Method:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: paymentMethod === 'cash' ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: paymentMethod === 'cash' ? 'rgba(184, 127, 92, 0.08)' : '#ffffff',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '13px',
                      boxShadow: paymentMethod === 'cash' ? '0 4px 12px rgba(184, 127, 92, 0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Banknote size={17} color="var(--primary)" /> Cash
                  </button>

                  <button
                    onClick={() => setPaymentMethod('card')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: paymentMethod === 'card' ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: paymentMethod === 'card' ? 'rgba(184, 127, 92, 0.08)' : '#ffffff',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '13px',
                      boxShadow: paymentMethod === 'card' ? '0 4px 12px rgba(184, 127, 92, 0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <CreditCard size={17} color="var(--primary)" /> Card (POS)
                  </button>

                  <button
                    onClick={() => setPaymentMethod('online')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: paymentMethod === 'online' ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: paymentMethod === 'online' ? 'rgba(184, 127, 92, 0.08)' : '#ffffff',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '13px',
                      boxShadow: paymentMethod === 'online' ? '0 4px 12px rgba(184, 127, 92, 0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <CheckCircle2 size={17} color="var(--primary)" /> Online Paid
                  </button>
                </div>
              </div>

              {/* Cash Tendered & Change Calculator */}
              {paymentMethod === 'cash' && (
                <div style={{
                  padding: '14px 18px',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Left: Input */}
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Cash Received (LKR):
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 5000"
                        value={cashTendered}
                        onChange={e => setCashTendered(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          fontSize: '15px',
                          fontWeight: '800',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          outline: 'none',
                          color: 'var(--text-primary)'
                        }}
                      />
                      {/* Quick amount shortcuts */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {[finalTotal, Math.ceil(finalTotal / 1000) * 1000, 5000, 10000, 15000, 20000].filter((v, i, a) => a.indexOf(v) === i && v >= finalTotal).slice(0, 4).map(amt => (
                          <button
                            key={amt}
                            onClick={() => setCashTendered(String(amt))}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: '#ffffff',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: 'var(--primary)'
                            }}
                          >
                            LKR {Math.round(amt).toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right: Digital Emerald Change Box */}
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Change to Return:
                      </label>
                      <div style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                        border: '1px solid #a7f3d0',
                        color: '#047857',
                        fontSize: '20px',
                        fontWeight: '800',
                        fontVariantNumeric: 'tabular-nums',
                        boxShadow: '0 4px 10px rgba(16, 185, 129, 0.12)'
                      }}>
                        LKR {changeDue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. PINNED BOTTOM FOOTER WITH SUMMARY LEDGER & ACTIONS */}
            <div style={{
              flexShrink: 0,
              background: 'linear-gradient(180deg, #ffffff 0%, #faf8f6 100%)',
              borderTop: '1px solid rgba(184, 127, 92, 0.16)',
              padding: '14px 28px 20px',
              boxShadow: '0 -6px 20px rgba(0, 0, 0, 0.03)'
            }}>
              {/* Financial Ledger Compact Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px 16px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginBottom: '10px',
                paddingBottom: '10px',
                borderBottom: '1px dashed rgba(184, 127, 92, 0.22)'
              }}>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>Subtotal:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>LKR {subtotal.toFixed(2)}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>Service (10%):</span>
                  <strong style={{ color: 'var(--text-primary)' }}>LKR {serviceCharge.toFixed(2)}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>Discount:</span>
                  <strong style={{ color: discountPercent > 0 ? '#059669' : 'var(--text-primary)' }}>
                    {discountPercent > 0 ? `-LKR ${discountVal.toFixed(2)}` : 'LKR 0.00'}
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>VAT/Tax (8%):</span>
                  <strong style={{ color: 'var(--text-primary)' }}>LKR {taxAmount.toFixed(2)}</strong>
                </div>
              </div>

              {/* Total Payable & Actions Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
                    Total Payable
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                    LKR {finalTotal.toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flex: 1, justifyContent: 'flex-end' }}>
                  <button
                    onClick={handlePrintReceipt}
                    style={{
                      padding: '11px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: '700',
                      fontSize: '13px',
                      borderRadius: '11px',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                  >
                    <Printer size={16} /> Print
                  </button>

                  <button
                    onClick={handleSettleBill}
                    disabled={isProcessing}
                    style={{
                      padding: '11px 22px',
                      fontWeight: '800',
                      fontSize: '14px',
                      borderRadius: '11px',
                      border: 'none',
                      background: 'linear-gradient(135deg, var(--primary) 0%, #9c6848 100%)',
                      color: '#ffffff',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      opacity: isProcessing ? 0.7 : 1,
                      boxShadow: '0 6px 16px rgba(184, 127, 92, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Confirm & Free Table</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Thermal Receipt Print Template */}
      {selectedTable && (
        <div id="pos-receipt-print" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 2px 0' }}>
              TABLEFLOW
            </h2>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 'bold', margin: '0 0 3px 0' }}>
              Boutique Dining & Lounge
            </p>
            <p style={{ fontSize: '10px', color: '#333', margin: 0 }}>
              123 Galle Road, Colombo 03 • Tel: +94 11 234 5678
            </p>
            <p style={{ fontSize: '10px', color: '#555', margin: '3px 0 0 0' }}>
              Date: {new Date().toLocaleString()}
            </p>
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

          <div style={{ fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>TABLE: #{selectedTable.table_number}</strong></span>
              <span><strong>GUEST: {selectedOrder?.users?.full_name || 'Dine-In Customer'}</strong></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
              <span>Check: {isTableWide ? `Consolidated (${activeOrdersList.length} Orders)` : `Ticket #${selectedOrder?.id?.substring(0, 8)}`}</span>
              <span>Cashier: {userRole?.toUpperCase()}</span>
            </div>
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

          <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ padding: '3px 0' }}>Item</th>
                <th style={{ padding: '3px 0', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '3px 0', textAlign: 'right' }}>Amount (LKR)</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((i, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '4px 0' }}>
                    {isTableWide && activeOrdersList.length > 1 && `[T#${i.ticketNum}] `}
                    {i.menu_items?.name || 'Item'}
                  </td>
                  <td style={{ padding: '4px 0', textAlign: 'center' }}>{i.quantity}</td>
                  <td style={{ padding: '4px 0', textAlign: 'right' }}>
                    {(i.quantity * parseFloat(i.unit_price)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

          <div style={{ fontSize: '11px', lineHeight: 1.5 }}>
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
            <div style={{ borderBottom: '2px solid #000', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
              <span>TOTAL PAYABLE:</span>
              <span>LKR {finalTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span>Tender Method:</span>
              <span>{paymentMethod.toUpperCase()}</span>
            </div>
            {paymentMethod === 'cash' && tenderedNum > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash Tendered:</span>
                  <span>LKR {tenderedNum.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Change Returned:</span>
                  <span>LKR {changeDue.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '12px 0' }} />

          <div style={{ textAlign: 'center', fontSize: '10px', lineHeight: 1.4 }}>
            <strong>*** THANK YOU FOR VISITING ***</strong><br />
            Please retain this bill for your receipt records.<br />
            TableFlow POS System
          </div>
        </div>
      )}
    </div>
  );
}
