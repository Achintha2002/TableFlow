"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const RESTAURANT_HOTLINE = '+94 11 234 5678';

function badge(type, text) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

function getElapsedMinutes(createdAt, currentTime) {
  if (!createdAt) return 999;
  const now = currentTime || Date.now();
  const diff = Math.round((now - new Date(createdAt).getTime()) / 60000);
  return diff < 0 ? 0 : diff;
}

function isWithinGracePeriod(createdAt, currentTime) {
  return getElapsedMinutes(createdAt, currentTime) < 10;
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Hotline Cancel Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedResForCancel, setSelectedResForCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('Customer called hotline (>10m policy)');
  const [staffNote, setStaffNote] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Reply Modal State
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedResForReply, setSelectedResForReply] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Floating Toast State
  const [toastMessage, setToastMessage] = useState(null);

  const fetchReservations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, restaurant_tables(table_number), users(full_name, phone_number, email)')
        .order('reservation_date', { ascending: false })
        .order('reservation_time', { ascending: false });

      if (error) {
        console.error('Error fetching reservations:', error);
      } else {
        setReservations(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const { data, error } = await supabase
          .from('reservations')
          .select('*, restaurant_tables(table_number), users(full_name, phone_number, email)')
          .order('reservation_date', { ascending: false })
          .order('reservation_time', { ascending: false });

        if (!ignore) {
          if (!error && data) {
            setReservations(data);
          }
          setLoading(false);
        }
      } catch (e) {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  function openCancelModal(res) {
    setSelectedResForCancel(res);
    setCancelReason('Customer called hotline (>10m policy)');
    setStaffNote('');
    setCancelModalOpen(true);
  }

  async function callReservationStatusApi(id, payload) {
    // 1. Try local Next.js API route
    try {
      const res = await fetch(`/api/admin/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Next.js API route failed, attempting backend fallback:', e);
    }

    // 2. Fallback to Express backend API
    const backendRes = await fetch(`http://localhost:3000/api/admin/reservations/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!backendRes.ok) {
      const errData = await backendRes.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${backendRes.status}`);
    }
    return await backendRes.json();
  }

  async function updateStatus(id, newStatus) {
    if (newStatus === 'cancelled') {
      const res = reservations.find(r => r.id === id);
      if (res) {
        openCancelModal(res);
        return;
      }
    }

    try {
      // Optimistic update
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      await callReservationStatusApi(id, { status: newStatus });
      fetchReservations();
    } catch (err) {
      alert('Failed to update reservation status: ' + err.message);
      fetchReservations();
    }
  }

  async function handleConfirmCancel() {
    if (!selectedResForCancel) return;
    const targetId = selectedResForCancel.id;
    const targetGuest = selectedResForCancel.users?.full_name || 'Guest';
    const targetTable = selectedResForCancel.restaurant_tables?.table_number
      ? `Table ${selectedResForCancel.restaurant_tables.table_number}`
      : 'Reservation';

    const noteToSave = staffNote.trim()
      ? `[Cancelled: ${cancelReason}] ${staffNote.trim()}`
      : `[Cancelled via Hotline: ${cancelReason}]`;

    // 1. Close modal IMMEDIATELY (auto dismiss)
    setCancelModalOpen(false);
    setSelectedResForCancel(null);

    // 2. Optimistic UI update so table row shows CANCELLED right away
    setReservations(prev => prev.map(r => r.id === targetId ? {
      ...r,
      status: 'cancelled',
      admin_reply: noteToSave
    } : r));

    // 3. Show floating toast notification
    setToastMessage(`✓ ${targetTable} (${targetGuest}) cancelled successfully!`);
    setTimeout(() => setToastMessage(null), 3500);

    // 4. Background API persistence
    try {
      await callReservationStatusApi(targetId, {
        status: 'cancelled',
        admin_reply: noteToSave,
        cancel_reason: cancelReason,
        staff_note: staffNote.trim()
      });
      fetchReservations();
    } catch (err) {
      console.error('Error syncing cancel with backend:', err);
      fetchReservations();
    }
  }

  function openReplyModal(res) {
    setSelectedResForReply(res);
    setReplyText(res.admin_reply || '');
    setReplyModalOpen(true);
  }

  async function handleSaveReply() {
    if (!selectedResForReply) return;
    const targetId = selectedResForReply.id;
    const trimmed = replyText.trim();

    // 1. Close modal IMMEDIATELY (auto dismiss)
    setReplyModalOpen(false);
    setSelectedResForReply(null);

    // 2. Optimistic update
    setReservations(prev => prev.map(r => r.id === targetId ? {
      ...r,
      admin_reply: trimmed || null
    } : r));

    setToastMessage('✓ Reply note saved successfully!');
    setTimeout(() => setToastMessage(null), 3000);

    try {
      await callReservationStatusApi(targetId, {
        status: selectedResForReply.status,
        admin_reply: trimmed || null
      });
      fetchReservations();
    } catch (err) {
      console.error('Error saving reply:', err);
      fetchReservations();
    }
  }

  // Summary statistics
  const stats = useMemo(() => {
    let total = reservations.length;
    let confirmed = 0;
    let inGrace = 0;
    let hotlineRequired = 0;
    let cancelled = 0;

    reservations.forEach(r => {
      if (r.status === 'confirmed') confirmed++;
      if (r.status === 'cancelled') cancelled++;
      if (r.status !== 'cancelled' && r.status !== 'completed') {
        if (isWithinGracePeriod(r.created_at, currentTime)) {
          inGrace++;
        } else {
          hotlineRequired++;
        }
      }
    });

    return { total, confirmed, inGrace, hotlineRequired, cancelled };
  }, [reservations, currentTime]);

  // Filtered reservations
  const filteredReservations = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return reservations.filter(r => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const guestName = (r.users?.full_name || '').toLowerCase();
        const phone = (r.users?.phone_number || '').toLowerCase();
        const email = (r.users?.email || '').toLowerCase();
        const table = (r.restaurant_tables?.table_number?.toString() || '').toLowerCase();
        const matches = guestName.includes(q) || phone.includes(q) || email.includes(q) || table.includes(q);
        if (!matches) return false;
      }

      // Date filter
      if (dateFilter === 'TODAY' && r.reservation_date !== todayStr) return false;
      if (dateFilter === 'UPCOMING' && r.reservation_date < todayStr) return false;

      // Status filter
      if (statusFilter === 'CONFIRMED' && r.status !== 'confirmed') return false;
      if (statusFilter === 'PENDING' && r.status !== 'pending') return false;
      if (statusFilter === 'CANCELLED' && r.status !== 'cancelled') return false;
      if (statusFilter === 'GRACE_PERIOD') {
        if (r.status === 'cancelled' || r.status === 'completed' || !isWithinGracePeriod(r.created_at, currentTime)) return false;
      }
      if (statusFilter === 'HOTLINE_REQUIRED') {
        if (r.status === 'cancelled' || r.status === 'completed' || isWithinGracePeriod(r.created_at, currentTime)) return false;
      }

      return true;
    });
  }, [reservations, searchQuery, statusFilter, dateFilter, currentTime]);

  if (loading) return <p style={{ color: 'var(--text-muted)', padding: '24px' }}>Loading reservations...</p>;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* ── 1. Policy & Hotline Information Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #fdf8f4 100%)',
        border: '1px solid #ebdcd0',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>📞</span>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Reservations & Hotline Management
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', maxWidth: '750px', lineHeight: 1.5 }}>
              <b>10-Minute Policy:</b> Guests can self-cancel directly via the mobile app within the first 10 minutes of booking.
              After 10 minutes, mobile self-cancellation is locked and callers are directed to the <b>Hotline ({RESTAURANT_HOTLINE})</b>.
              Administrators and staff can process cancellations or adjust tables at any time below.
            </p>
          </div>
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--primary)',
            borderRadius: '12px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 2px 6px rgba(184, 127, 92, 0.08)'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Official Hotline</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>{RESTAURANT_HOTLINE}</div>
            </div>
            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>Active 24/7</span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginTop: '18px',
          paddingTop: '16px',
          borderTop: '1px solid #f0e6dc'
        }}>
          <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #ebdcd0' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL BOOKINGS</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.total}</div>
          </div>
          <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1fae5' }}>
            <div style={{ fontSize: '11px', color: '#047857', fontWeight: '600' }}>CONFIRMED</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>{stats.confirmed}</div>
          </div>
          <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>🟢 IN GRACE PERIOD (&lt;10m)</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a' }}>{stats.inGrace}</div>
            <div style={{ fontSize: '10px', color: '#15803d' }}>Customer self-cancel active</div>
          </div>
          <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fed7aa' }}>
            <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: '600' }}>📞 HOTLINE REQUIRED (&gt;10m)</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#ea580c' }}>{stats.hotlineRequired}</div>
            <div style={{ fontSize: '10px', color: '#c2410c' }}>Must call hotline to cancel</div>
          </div>
          <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: '600' }}>CANCELLED</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626' }}>{stats.cancelled}</div>
          </div>
        </div>
      </div>

      {/* ── 2. Filters & Search Bar ── */}
      <div className="full-data-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '280px', flex: '1' }}>
            <input
              type="text"
              placeholder="Search by customer name, phone, email, or table #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                color: 'var(--text-primary)'
              }}
            />
            <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)', fontSize: '14px' }}>🔍</span>
          </div>

          {/* Date Filter */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Date:</span>
            {['ALL', 'TODAY', 'UPCOMING'].map(d => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: dateFilter === d ? '700' : '500',
                  border: dateFilter === d ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: dateFilter === d ? 'rgba(184, 127, 92, 0.1)' : '#ffffff',
                  color: dateFilter === d ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {d === 'ALL' ? 'All Dates' : d === 'TODAY' ? 'Today' : 'Upcoming'}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'CONFIRMED', label: 'Confirmed' },
            { id: 'GRACE_PERIOD', label: '🟢 Grace Period (<10m)' },
            { id: 'HOTLINE_REQUIRED', label: '📞 Hotline Required (>10m)' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'CANCELLED', label: 'Cancelled' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: statusFilter === tab.id ? '700' : '500',
                border: statusFilter === tab.id ? '1px solid var(--text-primary)' : '1px solid var(--border)',
                background: statusFilter === tab.id ? 'var(--text-primary)' : '#ffffff',
                color: statusFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. Reservations Table ── */}
      <div className="full-data-card">
        <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Reservations ({filteredReservations.length})</h3>
          <button
            onClick={fetchReservations}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-secondary)'
            }}
          >
            🔄 Refresh
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Date & Time</th>
              <th>Table & Pax</th>
              <th>10-Min Policy Status</th>
              <th>Special Requests & Reply</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReservations.length > 0 ? filteredReservations.map(r => {
              const elapsedMins = getElapsedMinutes(r.created_at, currentTime);
              const inGrace = isWithinGracePeriod(r.created_at, currentTime);
              const isCancelled = r.status === 'cancelled';
              const isCompleted = r.status === 'completed';

              return (
                <tr key={r.id}>
                  {/* Customer Info */}
                  <td>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
                      {r.users?.full_name || 'Guest'}
                    </div>
                    {r.users?.phone_number ? (
                      <a
                        href={`tel:${r.users.phone_number}`}
                        style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                      >
                        📞 {r.users.phone_number}
                      </a>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No phone</span>
                    )}
                    {r.users?.email && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {r.users.email}
                      </div>
                    )}
                  </td>

                  {/* Date & Time */}
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{r.reservation_date}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>at {r.reservation_time ? r.reservation_time.slice(0, 5) : '19:00'}</div>
                  </td>

                  {/* Table & Pax */}
                  <td>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                      Table {r.restaurant_tables?.table_number ?? 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.pax} Guests</div>
                  </td>

                  {/* 10-Min Policy Status Badge */}
                  <td>
                    {isCancelled ? (
                      <span style={{ fontSize: '11px', color: '#991b1b', background: '#fee2e2', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                        Cancelled
                      </span>
                    ) : isCompleted ? (
                      <span style={{ fontSize: '11px', color: '#374151', background: '#f3f4f6', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                        Completed
                      </span>
                    ) : inGrace ? (
                      <div>
                        <span style={{
                          fontSize: '11px',
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#047857',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: '700',
                          display: 'inline-block'
                        }}>
                          🟢 Grace Period ({10 - elapsedMins}m left)
                        </span>
                        <div style={{ fontSize: '10px', color: '#047857', marginTop: '2px' }}>
                          Customer can self-cancel in app
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span style={{
                          fontSize: '11px',
                          background: 'rgba(245, 158, 11, 0.12)',
                          color: '#b45309',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: '700',
                          display: 'inline-block'
                        }}>
                          📞 Hotline Required
                        </span>
                        <div style={{ fontSize: '10px', color: '#b45309', marginTop: '2px' }}>
                          Booked {elapsedMins >= 60 ? `${Math.floor(elapsedMins/60)}h ${elapsedMins%60}m ago` : `${elapsedMins}m ago`}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Special Requests & Reply */}
                  <td>
                    {r.special_requests ? (
                      <div style={{ fontSize: '12px', maxWidth: '180px', color: 'var(--text-secondary)' }}>
                        <i>&quot;{r.special_requests}&quot;</i>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>None</span>
                    )}
                    {r.admin_reply && (
                      <div style={{
                        fontSize: '12px',
                        background: 'rgba(184, 127, 92, 0.08)',
                        borderLeft: '3px solid var(--primary)',
                        padding: '4px 8px',
                        borderRadius: '0 4px 4px 0',
                        marginTop: '6px',
                        maxWidth: '220px'
                      }}>
                        <b>Reply / Reason:</b> {r.admin_reply}
                      </div>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td>
                    {badge(
                      r.status === 'confirmed' ? 'success' : r.status === 'pending' ? 'warning' : r.status === 'cancelled' ? 'danger' : 'muted',
                      r.status.toUpperCase()
                    )}
                  </td>

                  {/* Actions */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select
                          className="status-dropdown"
                          value={r.status}
                          onChange={(e) => updateStatus(r.id, e.target.value)}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="completed">Completed</option>
                        </select>

                        <button
                          onClick={() => openReplyModal(r)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            background: '#ffffff',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            borderRadius: '4px'
                          }}
                        >
                          💬 Reply
                        </button>
                      </div>

                      {/* Hotline Cancellation Quick Button */}
                      {!isCancelled && !isCompleted && (
                        <button
                          onClick={() => openCancelModal(r)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#dc2626',
                            borderRadius: '4px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          📞 Cancel via Hotline
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px' }}>
                  No reservations matching your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 4. Hotline Cancellation Modal ── */}
      {cancelModalOpen && selectedResForCancel && (
        <div 
          onClick={() => {
            setCancelModalOpen(false);
            setSelectedResForCancel(null);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(3px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '8px',
                  borderRadius: '10px',
                  color: '#dc2626',
                  fontSize: '18px'
                }}>
                  📞
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Process Hotline Cancellation
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Record cancellation details requested via Hotline ({RESTAURANT_HOTLINE})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCancelModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Reservation Summary Card */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Guest:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                  {selectedResForCancel.users?.full_name || 'Guest'} {selectedResForCancel.users?.phone_number ? `(${selectedResForCancel.users.phone_number})` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Table:</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                  Table {selectedResForCancel.restaurant_tables?.table_number ?? 'N/A'} • {selectedResForCancel.pax} Guests
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Schedule:</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selectedResForCancel.reservation_date} at {selectedResForCancel.reservation_time?.slice(0, 5)}
                </span>
              </div>
            </div>

            {/* Cancellation Reason Dropdown */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                Cancellation Reason:
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#ffffff'
                }}
              >
                <option value="Customer called hotline (>10m policy)">Customer called hotline (&gt;10m policy expired)</option>
                <option value="Customer emergency / illness">Customer emergency / illness</option>
                <option value="Customer change of plans / rescheduling">Customer change of plans / rescheduling</option>
                <option value="Guest delayed / No-show">Guest delayed / No-show</option>
                <option value="Operational / Table re-arrangement">Operational / Table re-arrangement</option>
                <option value="Duplicate booking">Duplicate booking</option>
                <option value="Other customer request">Other customer request</option>
              </select>
            </div>

            {/* Staff Internal Note / Explanation */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                Staff Note (Visible to Customer in App History):
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Guest phoned to cancel table due to heavy rain. Informed them table is released."
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                disabled={isSubmittingCancel}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Back / Dismiss
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isSubmittingCancel ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Confirm Hotline Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Admin Reply Modal ── */}
      {replyModalOpen && selectedResForReply && (
        <div 
          onClick={() => {
            setReplyModalOpen(false);
            setSelectedResForReply(null);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(3px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Reply to Guest
              </h3>
              <button
                onClick={() => setReplyModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Replying to <b>{selectedResForReply.users?.full_name || 'Guest'}</b> for Table {selectedResForReply.restaurant_tables?.table_number ?? 'N/A'}. This message will appear on their mobile app booking card.
            </p>

            <textarea
              rows={4}
              placeholder="Enter message for the customer..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                marginBottom: '16px'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setReplyModalOpen(false)}
                disabled={isSubmittingReply}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReply}
                disabled={isSubmittingReply}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isSubmittingReply ? 'not-allowed' : 'pointer'
                }}
              >
                Send Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Toast Notification ── */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '28px',
          right: '28px',
          background: '#0f172a',
          color: '#ffffff',
          padding: '14px 22px',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px',
          fontWeight: '600',
          zIndex: 9999,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <span style={{ color: '#22c55e', fontSize: '18px', fontWeight: 'bold' }}>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
