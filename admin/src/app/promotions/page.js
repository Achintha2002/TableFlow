"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TicketPercent,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  X,
  Tag,
  TrendingUp,
  Percent,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  Ban
} from 'lucide-react';

export default function PromotionsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'EXPIRED' | 'INACTIVE'
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'PERCENT' | 'FLAT'

  // Clipboard copy state
  const [copiedCode, setCopiedCode] = useState(null);

  // Modal State (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percent', // 'percent' | 'flat'
    discount_value: 15,
    min_order_amount: 1500,
    max_uses_per_user: 1,
    has_expiry: true,
    valid_until: '',
    is_active: true
  });

  // Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // Fetch Coupons
  async function fetchCoupons(isManual = false) {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/coupons');
      if (res.ok) {
        const json = await res.json();
        setCoupons(json.coupons || []);
      } else {
        // Direct Supabase Fallback
        const { data, error } = await supabase
          .from('coupons')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setCoupons(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
      showToast('Error loading vouchers: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchCoupons();

    // Supabase Real-time updates
    const channel = supabase
      .channel('realtime_coupons_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => {
        fetchCoupons();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Quick Copy to Clipboard
  function copyToClipboard(code) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Code "${code}" copied to clipboard!`, 'success');
    setTimeout(() => setCopiedCode(null), 2000);
  }

  // Generate random promo code suggestion
  function generateRandomCode() {
    const prefixes = ['TF', 'FEAST', 'CHEF', 'SAVE', 'VIP', 'WELCOME', 'TASTE'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const val = formData.discount_type === 'percent' ? formData.discount_value : Math.round(formData.discount_value);
    const randomSuffix = Math.floor(10 + Math.random() * 90);
    const suggested = `${randomPrefix}${val || 20}_${randomSuffix}`.toUpperCase();
    setFormData(prev => ({ ...prev, code: suggested }));
  }

  // Open Create Modal
  function handleOpenCreate() {
    setEditingId(null);
    const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    setFormData({
      code: '',
      description: '',
      discount_type: 'percent',
      discount_value: 15,
      min_order_amount: 1500,
      max_uses_per_user: 1,
      has_expiry: true,
      valid_until: defaultExpiry,
      is_active: true
    });
    setModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(coupon) {
    setEditingId(coupon.id);
    const isFlat = parseFloat(coupon.discount_amount) > 0 && !(coupon.discount_percent > 0);
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: isFlat ? 'flat' : 'percent',
      discount_value: isFlat ? parseFloat(coupon.discount_amount) : (coupon.discount_percent || 0),
      min_order_amount: parseFloat(coupon.min_order_amount) || 0,
      max_uses_per_user: coupon.max_uses_per_user || 1,
      has_expiry: Boolean(coupon.valid_until),
      valid_until: coupon.valid_until ? new Date(coupon.valid_until).toISOString().slice(0, 16) : '',
      is_active: coupon.is_active !== false
    });
    setModalOpen(true);
  }

  // Save (Create or Update)
  async function handleSave(e) {
    e.preventDefault();
    if (!formData.code.trim()) {
      showToast('Please enter a voucher code.', 'error');
      return;
    }

    if (formData.discount_value <= 0) {
      showToast('Discount value must be greater than zero.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim(),
        discount_percent: formData.discount_type === 'percent' ? Number(formData.discount_value) : 0,
        discount_amount: formData.discount_type === 'flat' ? Number(formData.discount_value) : 0,
        min_order_amount: Number(formData.min_order_amount) || 0,
        max_uses_per_user: Number(formData.max_uses_per_user) || 1,
        is_active: formData.is_active,
        valid_until: formData.has_expiry && formData.valid_until ? new Date(formData.valid_until).toISOString() : null
      };

      let res;
      if (editingId) {
        res = await fetch(`/api/admin/coupons/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/admin/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save voucher');

      showToast(editingId ? 'Voucher updated successfully!' : 'New voucher created successfully!');
      setModalOpen(false);
      fetchCoupons();
    } catch (err) {
      console.error('Save error:', err);
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Quick Toggle Active Status
  async function toggleStatus(coupon) {
    const newStatus = !coupon.is_active;
    // Optimistic UI update
    setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: newStatus } : c));

    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus })
      });
      if (!res.ok) throw new Error('Status update failed');
      showToast(`Code "${coupon.code}" is now ${newStatus ? 'Active' : 'Inactive'}.`);
    } catch (err) {
      fetchCoupons();
      showToast('Failed to toggle status: ' + err.message, 'error');
    }
  }

  // Handle Delete
  async function confirmDelete() {
    if (!couponToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/coupons/${couponToDelete.id}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');

      if (json.archived) {
        showToast(json.message, 'info');
      } else {
        showToast(`Voucher "${couponToDelete.code}" deleted permanently.`);
      }
      setDeleteModalOpen(false);
      setCouponToDelete(null);
      fetchCoupons();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Error deleting: ' + err.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  // Filtered & Sorted Coupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter(c => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        c.code.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Status Filter
      const isExpired = c.valid_until && new Date(c.valid_until) < new Date();
      if (filterStatus === 'ACTIVE' && (!c.is_active || isExpired)) return false;
      if (filterStatus === 'EXPIRED' && !isExpired) return false;
      if (filterStatus === 'INACTIVE' && c.is_active) return false;

      // Type Filter
      const isPercent = Number(c.discount_percent) > 0;
      const isFlat = Number(c.discount_amount) > 0;
      if (filterType === 'PERCENT' && !isPercent) return false;
      if (filterType === 'FLAT' && !isFlat) return false;

      return true;
    });
  }, [coupons, searchQuery, filterStatus, filterType]);

  // Key Metrics
  const metrics = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter(c => c.is_active && (!c.valid_until || new Date(c.valid_until) >= new Date())).length;
    const totalRedeemed = coupons.reduce((sum, c) => sum + (c.redemptions_count || 0), 0);
    const expiringSoon = coupons.filter(c => {
      if (!c.valid_until || !c.is_active) return false;
      const diffDays = (new Date(c.valid_until) - new Date()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }).length;

    return { total, active, totalRedeemed, expiringSoon };
  }, [coupons]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1440px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          padding: '12px 18px',
          borderRadius: '10px',
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#10b981',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '13px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        background: '#ffffff',
        padding: '22px 26px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #B87F5C 0%, #9c6848 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(184, 127, 92, 0.35)'
          }}>
            <TicketPercent size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Promotions &amp; Discount Vouchers
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Manage promotional codes, bill discounts, and customer redemption limits.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchCoupons(true)}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleOpenCreate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #B87F5C 0%, #9c6848 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(184, 127, 92, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            <Plus size={16} />
            <span>Create New Voucher</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tag size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700 }}>Total Vouchers</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{metrics.total}</div>
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700 }}>Active Campaigns</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a' }}>{metrics.active}</div>
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700 }}>Total Redemptions</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#4f46e5' }}>{metrics.totalRedeemed}</div>
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700 }}>Expiring &lt; 7 Days</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626' }}>{metrics.expiringSoon}</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{
        background: '#ffffff',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '240px', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by code or description..."
            style={{
              width: '100%',
              padding: '9px 14px 9px 38px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '13px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
            {['ALL', 'ACTIVE', 'EXPIRED', 'INACTIVE'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterStatus === status ? '#ffffff' : 'transparent',
                  color: filterStatus === status ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: filterStatus === status ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
            {[
              { id: 'ALL', label: 'All Types' },
              { id: 'PERCENT', label: '% Percentage' },
              { id: 'FLAT', label: 'LKR Flat' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setFilterType(type.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterType === type.id ? '#ffffff' : 'transparent',
                  color: filterType === type.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: filterType === type.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Coupons Table */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 600 }}>Loading promotions...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div style={{ padding: '70px 20px', textAlign: 'center' }}>
            <TicketPercent size={44} style={{ color: '#cbd5e1', margin: '0 auto 14px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>No vouchers found</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 18px' }}>
              {searchQuery ? 'Try clearing your search query or filters.' : 'Create your first discount voucher to boost sales!'}
            </p>
            <button
              onClick={handleOpenCreate}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              + Create Voucher
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.8px' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>Voucher Code</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>Discount Offer</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>Rules &amp; Limits</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>Redemptions</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>Validity</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoupons.map((coupon, idx) => {
                  const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
                  const isPercent = Number(coupon.discount_percent) > 0;
                  const discountLabel = isPercent
                    ? `${coupon.discount_percent}% OFF`
                    : `LKR ${Number(coupon.discount_amount).toLocaleString()} OFF`;

                  return (
                    <tr
                      key={coupon.id}
                      style={{
                        borderBottom: idx === filteredCoupons.length - 1 ? 'none' : '1px solid #f1f5f9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Code */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            fontWeight: 800,
                            letterSpacing: '1px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1'
                          }}>
                            {coupon.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(coupon.code)}
                            title="Copy code"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedCode === coupon.code ? '#10b981' : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            {copiedCode === coupon.code ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        {coupon.description && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '240px' }}>
                            {coupon.description}
                          </div>
                        )}
                      </td>

                      {/* Discount Value */}
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          background: isPercent ? '#fef3c7' : '#ecfdf5',
                          color: isPercent ? '#b45309' : '#047857'
                        }}>
                          {isPercent ? <Percent size={13} /> : <DollarSign size={13} />}
                          {discountLabel}
                        </span>
                      </td>

                      {/* Rules */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            Min Spend: <strong>{Number(coupon.min_order_amount) > 0 ? `LKR ${Number(coupon.min_order_amount).toLocaleString()}` : 'None'}</strong>
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            Limit: {coupon.max_uses_per_user || 1} use/customer
                          </span>
                        </div>
                      </td>

                      {/* Redemptions */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {coupon.redemptions_count || 0}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>uses</span>
                        </div>
                      </td>

                      {/* Validity */}
                      <td style={{ padding: '16px 20px' }}>
                        {coupon.valid_until ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isExpired ? '#dc2626' : 'var(--text-secondary)'
                            }}>
                              {new Date(coupon.valid_until).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                              })}
                            </span>
                            <span style={{ fontSize: '11px', color: isExpired ? '#ef4444' : 'var(--text-muted)' }}>
                              {isExpired ? 'Expired' : `${Math.max(0, Math.ceil((new Date(coupon.valid_until) - new Date()) / (1000 * 60 * 60 * 24)))} days left`}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                            Never Expires
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 20px' }}>
                        <button
                          onClick={() => toggleStatus(coupon)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: isExpired ? '#fee2e2' : coupon.is_active ? '#dcfce7' : '#f1f5f9',
                            color: isExpired ? '#dc2626' : coupon.is_active ? '#15803d' : '#64748b'
                          }}
                        >
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isExpired ? '#dc2626' : coupon.is_active ? '#16a34a' : '#94a3b8'
                          }} />
                          {isExpired ? 'Expired' : coupon.is_active ? 'Active' : 'Paused'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenEdit(coupon)}
                            title="Edit Voucher"
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            onClick={() => {
                              setCouponToDelete(coupon);
                              setDeleteModalOpen(true);
                            }}
                            title="Delete Voucher"
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid #fee2e2',
                              background: '#fff5f5',
                              color: '#ef4444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {editingId ? 'Edit Discount Voucher' : 'Create New Discount Voucher'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Set discount values, minimum bill conditions, and customer limits.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>
              
              {/* Code Input & Generator */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  VOUCHER CODE *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="e.g. WELCOME20, FEAST500"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <Sparkles size={14} color="#B87F5C" />
                    Auto-Generate
                  </button>
                </div>
              </div>

              {/* Discount Type Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  DISCOUNT TYPE *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'percent' })}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: formData.discount_type === 'percent' ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                      background: formData.discount_type === 'percent' ? '#fff7ed' : '#ffffff',
                      color: formData.discount_type === 'percent' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Percent size={15} />
                    Percentage (%)
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'flat' })}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: formData.discount_type === 'flat' ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                      background: formData.discount_type === 'flat' ? '#fff7ed' : '#ffffff',
                      color: formData.discount_type === 'flat' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <DollarSign size={15} />
                    Fixed Amount (LKR)
                  </button>
                </div>
              </div>

              {/* Discount Value */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  {formData.discount_type === 'percent' ? 'DISCOUNT PERCENTAGE (%) *' : 'FLAT DISCOUNT AMOUNT (LKR) *'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={formData.discount_type === 'percent' ? '100' : '100000'}
                  value={formData.discount_value}
                  onChange={e => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                />
              </div>

              {/* Min Spend & Max Uses Per Customer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    MINIMUM BILL (LKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formData.min_order_amount}
                    onChange={e => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>0 for no minimum</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    USES PER CUSTOMER
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.max_uses_per_user}
                    onChange={e => setFormData({ ...formData, max_uses_per_user: parseInt(e.target.value, 10) || 1 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Redemptions per user</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  CAMPAIGN DESCRIPTION
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Weekend special 20% off for orders over LKR 3,000"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Expiry Settings */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    EXPIRATION DATE &amp; TIME
                  </label>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!formData.has_expiry}
                      onChange={e => setFormData({ ...formData, has_expiry: !e.target.checked })}
                    />
                    Never Expires
                  </label>
                </div>
                {formData.has_expiry && (
                  <input
                    type="datetime-local"
                    value={formData.valid_until}
                    onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                )}
              </div>

              {/* Active Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Voucher Active</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Allow customers and cashiers to redeem immediately</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #B87F5C 0%, #9c6848 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(184, 127, 92, 0.3)'
                  }}
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Voucher' : 'Create Voucher'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && couponToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Trash2 size={24} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Delete Voucher Code?
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to delete voucher <strong style={{ color: '#0f172a' }}>"{couponToDelete.code}"</strong>?
              {couponToDelete.redemptions_count > 0 && (
                <span style={{ display: 'block', marginTop: '6px', color: '#d97706', fontSize: '12px' }}>
                  ⚠️ This code has {couponToDelete.redemptions_count} past redemption records. To protect order history, it will be deactivated rather than deleted.
                </span>
              )}
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
