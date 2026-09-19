"use client";
import { useState, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  Download, Printer, Calendar, TrendingUp, TrendingDown, DollarSign, 
  ShoppingBag, CreditCard, CheckCircle2, Clock, Utensils, RefreshCw, 
  FileText, ShieldCheck, Award, X
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Date range filter
  const [dateRange, setDateRange] = useState('this_week'); // today, yesterday, this_week, this_month, custom
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Shift summary modal
  const [showShiftModal, setShowShiftModal] = useState(false);
  
  // Active chart tab (revenue vs volume)
  const [chartMetric, setChartMetric] = useState('revenue'); // revenue | orders

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE}/api/admin/reports/summary?range=${dateRange}`;
      if (dateRange === 'custom') {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load report data (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Unable to connect to analytics server');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [dateRange]);

  function handleApplyCustom() {
    if (dateRange === 'custom') {
      loadData();
    } else {
      setDateRange('custom');
    }
  }

  function handleExportCsv() {
    let exportUrl = `${API_BASE}/api/admin/reports/orders/export?range=${dateRange}`;
    if (dateRange === 'custom') {
      exportUrl += `&startDate=${customStart}&endDate=${customEnd}`;
    }
    
    // Trigger download via anchor element
    const link = document.createElement('a');
    link.href = exportUrl;
    link.setAttribute('download', `tableflow_sales_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrintShiftSummary() {
    window.print();
  }

  const paymentColors = {
    'Cash': '#10b981',
    'Card (POS)': '#3b82f6',
    'Online Card': '#8b5cf6',
    'Unsettled / Pending': '#f59e0b'
  };

  const statusBadgeColors = {
    'served': { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
    'ready': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    'preparing': { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
    'pending': { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
    'cancelled': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Print Styles for Shift Z-Report */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-shift-report, #print-shift-report * {
            visibility: visible !important;
          }
          #print-shift-report {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 30px !important;
            background: white !important;
            color: #000 !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: '700' }}>
              Sales Reports & Analytics
            </h1>
            <span style={{ fontSize: '12px', background: 'rgba(184, 127, 92, 0.12)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
              Live Reconciliation
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Real-time business performance, multi-channel payment breakdown, and shift reconciliation.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={loadData}
            title="Refresh Data"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span style={{ fontSize: '13px' }}>Refresh</span>
          </button>

          <button 
            onClick={() => setShowShiftModal(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: '600' }}
          >
            <Printer size={16} />
            <span style={{ fontSize: '13px' }}>Shift Summary (PDF)</span>
          </button>

          <button 
            onClick={handleExportCsv}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: '600' }}
          >
            <Download size={16} />
            <span style={{ fontSize: '13px' }}>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range Navigation Toolbar */}
      <div style={{
        background: 'var(--bg-card)', 
        border: '1px solid var(--border)', 
        borderRadius: '12px', 
        padding: '12px 18px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: '14px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* Quick Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginRight: '4px' }}>Period:</span>
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'this_week', label: 'Last 7 Days' },
            { key: 'this_month', label: 'Last 30 Days' },
            { key: 'custom', label: 'Custom Range' }
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setDateRange(p.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: dateRange === p.key ? '600' : '500',
                border: dateRange === p.key ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: dateRange === p.key ? 'var(--primary)' : 'var(--bg-surface)',
                color: dateRange === p.key ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Range Picker */}
        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="date"
              className="input"
              style={{ padding: '6px 10px', fontSize: '13px' }}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
            <input 
              type="date"
              className="input"
              style={{ padding: '6px 10px', fontSize: '13px' }}
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
            <button 
              onClick={handleApplyCustom}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              Apply
            </button>
          </div>
        )}

        {/* Current Active Window Label */}
        {data && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Calendar size={14} />
            <span>
              {new Date(data.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' — '}
              {new Date(data.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
          <p style={{ fontSize: '16px' }}>Loading real-time financial ledger & analytics...</p>
        </div>
      ) : error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '24px', color: '#b91c1c', textAlign: 'center' }}>
          <p style={{ fontWeight: '600', marginBottom: '8px' }}>Failed to Load Reports</p>
          <p style={{ fontSize: '14px', color: '#dc2626' }}>{error}</p>
          <button onClick={loadData} className="btn btn-primary" style={{ marginTop: '14px' }}>Retry</button>
        </div>
      ) : data ? (
        <>
          {/* Executive KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '24px' }}>
            {/* KPI 1: Gross Revenue */}
            <div className="data-card" style={{ padding: '20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Gross Revenue
                </span>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(184, 127, 92, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                  <DollarSign size={20} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                LKR {Number(data.summary.grossRevenue).toLocaleString()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  fontWeight: '600',
                  color: data.summary.revenueGrowth >= 0 ? 'var(--success)' : 'var(--danger)',
                  background: data.summary.revenueGrowth >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {data.summary.revenueGrowth >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {data.summary.revenueGrowth >= 0 ? `+${data.summary.revenueGrowth}%` : `${data.summary.revenueGrowth}%`}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>vs prior period</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                Net: <strong>LKR {Number(data.summary.netRevenue).toLocaleString()}</strong> (Discounts: LKR {Number(data.summary.totalDiscounts).toLocaleString()})
              </div>
            </div>

            {/* KPI 2: Total Orders */}
            <div className="data-card" style={{ padding: '20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Orders Handled
                </span>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                  <ShoppingBag size={20} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                {data.summary.ordersCount} <span style={{ fontSize: '16px', fontWeight: '400', color: 'var(--text-muted)' }}>checks</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  fontWeight: '600',
                  color: data.summary.ordersGrowth >= 0 ? 'var(--success)' : 'var(--danger)',
                  background: data.summary.ordersGrowth >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {data.summary.ordersGrowth >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {data.summary.ordersGrowth >= 0 ? `+${data.summary.ordersGrowth}%` : `${data.summary.ordersGrowth}%`}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>vs prior period</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                {data.summary.paidCount} Paid • {data.summary.pendingCount} Pending check
              </div>
            </div>

            {/* KPI 3: Average Check (AOV) */}
            <div className="data-card" style={{ padding: '20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Average Check Size
                </span>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <Award size={20} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                LKR {Number(data.summary.avgOrderValue).toLocaleString()}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Average spend per dining party
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                Healthy dining benchmark &gt; LKR 2,500
              </div>
            </div>

            {/* KPI 4: Settlement Rate */}
            <div className="data-card" style={{ padding: '20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Settlement Rate
                </span>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                {data.summary.ordersCount > 0 ? Math.round((data.summary.paidCount / data.summary.ordersCount) * 100) : 0}%
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {data.summary.paidCount} of {data.summary.ordersCount} orders fully settled
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                Unsettled balance: <strong>LKR {Number(data.shiftSummary.unsettledAmount).toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Analytics Visual Charts Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px', marginBottom: '24px' }}>
            {/* Timeline Trends Chart (Spans 8 columns) */}
            <div className="data-card" style={{ gridColumn: 'span 8', padding: '20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Sales & Activity Timeline</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {dateRange === 'today' || dateRange === 'yesterday' ? 'Hourly fluctuations over the shift' : 'Daily revenue trajectory over selected dates'}
                  </p>
                </div>
                
                {/* Metric toggle */}
                <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setChartMetric('revenue')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: chartMetric === 'revenue' ? '600' : '500',
                      background: chartMetric === 'revenue' ? 'var(--bg-card)' : 'transparent',
                      color: chartMetric === 'revenue' ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: chartMetric === 'revenue' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    Revenue (LKR)
                  </button>
                  <button
                    onClick={() => setChartMetric('orders')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: chartMetric === 'orders' ? '600' : '500',
                      background: chartMetric === 'orders' ? 'var(--bg-card)' : 'transparent',
                      color: chartMetric === 'orders' ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: chartMetric === 'orders' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    Order Volume
                  </button>
                </div>
              </div>

              <div style={{ height: '320px', width: '100%' }}>
                {data.timeSeries && data.timeSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.timeSeries} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#B87F5C" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#B87F5C" stopOpacity={0.02}/>
                        </linearGradient>
                        <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis 
                        dataKey={dateRange === 'today' || dateRange === 'yesterday' ? 'label' : 'label'} 
                        stroke="var(--text-muted)" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke="var(--text-muted)" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(val) => chartMetric === 'revenue' ? `${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}` : val} 
                      />
                      <RechartsTooltip 
                        formatter={(val) => [chartMetric === 'revenue' ? `LKR ${Number(val).toLocaleString()}` : `${val} Orders`, chartMetric === 'revenue' ? 'Revenue' : 'Orders']}
                        contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        itemStyle={{ color: chartMetric === 'revenue' ? '#B87F5C' : '#3b82f6', fontWeight: '600' }}
                      />
                      {chartMetric === 'revenue' ? (
                        <Area 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="#B87F5C" 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill="url(#colorRev)" 
                          activeDot={{ r: 6, fill: '#B87F5C', stroke: '#fff', strokeWidth: 2 }} 
                        />
                      ) : (
                        <Area 
                          type="monotone" 
                          dataKey="orders" 
                          stroke="#3b82f6" 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill="url(#colorOrders)" 
                          activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} 
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No sales recorded for this period
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method Breakdown (Spans 4 columns) */}
            <div className="data-card" style={{ gridColumn: 'span 4', padding: '20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Payment Breakdown
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Distribution by tender method & settlement
              </p>

              <div style={{ height: '200px', width: '100%' }}>
                {data.paymentBreakdown && data.paymentBreakdown.some(p => p.total > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.paymentBreakdown.filter(p => p.total > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="total"
                        nameKey="method"
                      >
                        {data.paymentBreakdown.filter(p => p.total > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={paymentColors[entry.method] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(val) => [`LKR ${Number(val).toLocaleString()}`, 'Amount']}
                        contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No settled payments in period
                  </div>
                )}
              </div>

              {/* Payment Legend List */}
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.paymentBreakdown && data.paymentBreakdown.map(p => (
                  <div key={p.method} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: paymentColors[p.method] || '#94a3b8' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{p.method} ({p.count})</span>
                    </div>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      LKR {Number(p.total).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Analytics Visual Charts Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px', marginBottom: '24px' }}>
            {/* Category Performance Bar Chart (Spans 6 columns) */}
            <div className="data-card" style={{ gridColumn: 'span 6', padding: '20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Menu Category Performance
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Revenue contribution by food & beverage category
              </p>

              <div style={{ height: '260px', width: '100%' }}>
                {data.categoryBreakdown && data.categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categoryBreakdown} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `LKR ${val}`} />
                      <YAxis dataKey="category" type="category" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} width={90} />
                      <RechartsTooltip 
                        formatter={(val, name, props) => [`LKR ${Number(val).toLocaleString()} (${props.payload.quantity} items)`, 'Revenue']}
                        contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      />
                      <Bar dataKey="revenue" fill="#B87F5C" radius={[0, 6, 6, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No category data available
                  </div>
                )}
              </div>
            </div>

            {/* Top 5 Best-Selling Dishes Leaderboard (Spans 6 columns) */}
            <div className="data-card" style={{ gridColumn: 'span 6', padding: '20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Top-Selling Dishes</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ranked by units sold & gross contribution</p>
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(184, 127, 92, 0.12)', color: 'var(--primary)', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                  Leaderboard
                </span>
              </div>

              {data.topSellingItems && data.topSellingItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.topSellingItems.slice(0, 5).map((item, idx) => (
                    <div 
                      key={item.name} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: idx === 0 ? 'rgba(184, 127, 92, 0.05)' : 'var(--bg-surface)',
                        borderRadius: '8px',
                        border: idx === 0 ? '1px solid rgba(184, 127, 92, 0.2)' : '1px solid transparent'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ 
                          width: '24px', 
                          height: '24px', 
                          borderRadius: '50%', 
                          background: idx === 0 ? '#B87F5C' : (idx === 1 ? '#94a3b8' : (idx === 2 ? '#cd7f32' : 'var(--border)')),
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {idx + 1}
                        </span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {item.category} • {item.quantity} sold
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          LKR {Number(item.revenue).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          gross sales
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No item sales in this period
                </div>
              )}
            </div>
          </div>

          {/* Recent Orders Ledger Table */}
          <div className="data-card" style={{ padding: '20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Order Ledger (Recent Activity)</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Detailed register logs for the selected window</p>
              </div>
              <button 
                onClick={handleExportCsv}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
              >
                <Download size={14} />
                <span>Export Ledger CSV</span>
              </button>
            </div>

            {data.recentOrders && data.recentOrders.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px' }}>
                      <th style={{ padding: '10px 12px' }}>Order ID</th>
                      <th style={{ padding: '10px 12px' }}>Time</th>
                      <th style={{ padding: '10px 12px' }}>Table</th>
                      <th style={{ padding: '10px 12px' }}>Line Items</th>
                      <th style={{ padding: '10px 12px' }}>Payment</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((o) => {
                      const badge = statusBadgeColors[o.status] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
                      return (
                        <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            #{o.id.slice(0, 8)}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {new Date(o.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {o.table_number}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-secondary)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={o.items_summary}>
                            {o.items_summary}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ 
                              fontSize: '11px',
                              fontWeight: '600',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: o.payment_status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: o.payment_status === 'paid' ? 'var(--success)' : 'var(--warning)'
                            }}>
                              {o.payment_method.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`
                            }}>
                              {o.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>
                            LKR {o.total_amount.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                No recent orders found
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Shift Closing Summary Modal (Z-Report / Audit Slip) */}
      {showShiftModal && data && data.shiftSummary && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div 
            id="print-shift-report"
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid #e2e8f0',
              fontFamily: 'var(--font-body)'
            }}
          >
            {/* Modal Header Actions (Hidden on Print) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Shift Closing Audit (Z-Report)
              </span>
              <button 
                onClick={() => setShowShiftModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Printable Receipt Body */}
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: '#0f172a', fontWeight: '700', marginBottom: '4px' }}>
                TABLEFLOW BOUTIQUE
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Daily Register Closing & Reconciliation
              </p>
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#334155' }}>
                <div>Period: <strong>{new Date(data.shiftSummary.periodStart).toLocaleDateString()} — {new Date(data.shiftSummary.periodEnd).toLocaleDateString()}</strong></div>
                <div>Generated: <strong>{new Date(data.shiftSummary.generatedAt).toLocaleString()}</strong></div>
              </div>
            </div>

            {/* Revenue Metrics Summary */}
            <div style={{ marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Gross Sales Volume</span>
                <span style={{ fontWeight: '600' }}>LKR {data.shiftSummary.grossSales.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#dc2626' }}>
                <span>Discounts Authorized (-)</span>
                <span style={{ fontWeight: '600' }}>LKR {data.shiftSummary.discounts.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #0f172a', fontWeight: '700', fontSize: '15px' }}>
                <span>Net Sales Revenue</span>
                <span>LKR {data.shiftSummary.netSales.toLocaleString()}</span>
              </div>
            </div>

            {/* Cash Drawer & Payment Reconciliation */}
            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                Drawer Tender Breakdown
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                <span style={{ color: '#475569' }}>💵 Cash In Drawer</span>
                <span style={{ fontWeight: '600' }}>LKR {data.shiftSummary.cashReceived.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                <span style={{ color: '#475569' }}>💳 Card Slips (POS)</span>
                <span style={{ fontWeight: '600' }}>LKR {data.shiftSummary.cardReceived.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                <span style={{ color: '#475569' }}>🌐 Online Card Settlements</span>
                <span style={{ fontWeight: '600' }}>LKR {data.shiftSummary.onlineReceived.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: '#d97706' }}>
                <span>⚠️ Unsettled Open Checks</span>
                <span style={{ fontWeight: '600' }}>LKR {data.shiftSummary.unsettledAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Order Count Audit */}
            <div style={{ marginBottom: '20px', fontSize: '12px', color: '#64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span>Total Checks Punched:</span>
                <strong style={{ color: '#0f172a' }}>{data.shiftSummary.totalOrders}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span>Settled Checks:</span>
                <strong style={{ color: '#0f172a' }}>{data.shiftSummary.paidOrdersCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span>Pending Open Checks:</span>
                <strong style={{ color: '#0f172a' }}>{data.shiftSummary.unsettledOrdersCount}</strong>
              </div>
            </div>

            {/* Verification Signature Section */}
            <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '16px', fontSize: '12px', color: '#64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                <div style={{ borderTop: '1px solid #94a3b8', width: '45%', paddingTop: '6px', textAlign: 'center' }}>
                  Manager Signature
                </div>
                <div style={{ borderTop: '1px solid #94a3b8', width: '45%', paddingTop: '6px', textAlign: 'center' }}>
                  Cashier / Server
                </div>
              </div>
            </div>

            {/* Bottom Modal Actions (Hidden on Print) */}
            <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button 
                onClick={handlePrintShiftSummary}
                className="btn btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
              >
                <Printer size={16} />
                <span>Print Z-Report</span>
              </button>
              <button 
                onClick={() => setShowShiftModal(false)}
                className="btn btn-secondary"
                style={{ padding: '12px 18px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
