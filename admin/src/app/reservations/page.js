"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Calendar,
  Clock,
  User,
  Users,
  Phone,
  PhoneCall,
  Search,
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  X,
  Filter,
  Ban,
  Check,
  ArrowRight,
  ChevronDown
} from 'lucide-react';

const RESTAURANT_HOTLINE = '+94 11 234 5678';

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentTimeString() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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

function formatReservationDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) {
    return dateStr;
  }
}

function formatReservationTime(timeStr) {
  if (!timeStr) return '07:00 PM';
  try {
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  } catch (_) {
    return timeStr;
  }
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [tablesList, setTablesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [toastMessage, setToastMessage] = useState(null);

  // ── CRUD MODALS STATE ──
  // 1. Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [newResData, setNewResData] = useState({
    customer_name: '',
    phone_number: '',
    email: '',
    reservation_date: new Date().toISOString().split('T')[0],
    reservation_time: '19:00',
    pax: 2,
    table_id: '',
    special_requests: '',
    status: 'confirmed'
  });

  // 2. Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editingRes, setEditingRes] = useState(null);
  const [editFormData, setEditFormData] = useState({
    customer_name: '',
    phone_number: '',
    email: '',
    reservation_date: '',
    reservation_time: '',
    pax: 2,
    table_id: '',
    special_requests: '',
    status: 'confirmed'
  });

  // 3. Delete Confirmation Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRes, setDeletingRes] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 4. Hotline Cancel Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedResForCancel, setSelectedResForCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('Customer called hotline (>10m policy)');
  const [staffNote, setStaffNote] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // 5. Reply Modal
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedResForReply, setSelectedResForReply] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // 6. View Note & Requests Modal
  const [viewNoteModalOpen, setViewNoteModalOpen] = useState(false);
  const [selectedResForNoteView, setSelectedResForNoteView] = useState(null);

  function openViewNoteModal(res) {
    setSelectedResForNoteView(res);
    setViewNoteModalOpen(true);
  }

  function showToast(msg, isError = false) {
    setToastMessage({ text: msg, isError });
    setTimeout(() => setToastMessage(null), 3800);
  }

  // Fetch Tables for Dropdown
  const fetchTables = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('id, table_number, capacity, status, location')
        .order('table_number', { ascending: true });
      if (!error && data) {
        setTablesList(data);
      }
    } catch (_) {}
  }, []);

  // Fetch Reservations with safe fallback
  const fetchReservations = useCallback(async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from('reservations')
        .select('*, restaurant_tables(id, table_number, capacity), users(id, full_name, phone_number, email)')
        .order('reservation_date', { ascending: false })
        .order('reservation_time', { ascending: false });

      if (error) {
        console.warn('Fetch reservations primary notice:', error.message);
        // Fallback fetch
        const { data: fbData } = await supabase
          .from('reservations')
          .select('*, restaurant_tables(table_number), users(full_name)')
          .order('reservation_date', { ascending: false });
        setReservations(fbData || []);
      } else {
        setReservations(data || []);
      }
    } catch (e) {
      console.error('Fetch error:', e);
      showToast('Could not refresh reservations', true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
    fetchTables();

    // Realtime subscriptions
    const channelId = Math.random().toString(36).substring(2, 9);
    const resChannel = supabase
      .channel(`reservations_page_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchReservations();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        fetchTables();
      })
      .subscribe();

    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);

    return () => {
      supabase.removeChannel(resChannel);
      clearInterval(timer);
    };
  }, [fetchReservations, fetchTables]);

  // ── CRUD: CREATE HANDLER ──
  function openCreateModal() {
    setNewResData({
      customer_name: '',
      phone_number: '',
      email: '',
      reservation_date: getTodayDateString(),
      reservation_time: '19:00',
      pax: 2,
      table_id: '',
      special_requests: '',
      status: 'confirmed'
    });
    setCreateModalOpen(true);
  }

  async function handleCreateReservation(e) {
    e.preventDefault();
    if (!newResData.customer_name.trim()) {
      showToast('Please enter customer / guest name', true);
      return;
    }
    if (!newResData.reservation_date || !newResData.reservation_time) {
      showToast('Please pick a date and time', true);
      return;
    }

    const todayStr = getTodayDateString();
    if (newResData.reservation_date < todayStr) {
      showToast('Cannot make a reservation for a past date. Please pick today or a future date.', true);
      return;
    }
    if (newResData.reservation_date === todayStr) {
      const nowTimeStr = getCurrentTimeString();
      if (newResData.reservation_time < nowTimeStr) {
        showToast('Cannot make a reservation for a past time today. Please pick an upcoming time.', true);
        return;
      }
    }

    try {
      setIsSubmittingCreate(true);
      const res = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResData)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create reservation');
      }

      setCreateModalOpen(false);
      showToast(`✓ Reservation for ${newResData.customer_name} created successfully!`);
      fetchReservations();
      fetchTables();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  // ── CRUD: UPDATE / EDIT HANDLER ──
  function openEditModal(res) {
    setEditingRes(res);
    setEditFormData({
      customer_name: res.users?.full_name || '',
      phone_number: res.users?.phone_number || '',
      email: res.users?.email || '',
      reservation_date: res.reservation_date || '',
      reservation_time: res.reservation_time ? res.reservation_time.slice(0, 5) : '19:00',
      pax: res.pax || 2,
      table_id: res.table_id ? String(res.table_id) : '',
      special_requests: res.special_requests || '',
      status: res.status || 'confirmed'
    });
    setEditModalOpen(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingRes) return;
    if (!editFormData.customer_name.trim()) {
      showToast('Please enter customer / guest name', true);
      return;
    }

    const todayStr = getTodayDateString();
    if (editFormData.reservation_date < todayStr) {
      showToast('Cannot update reservation to a past date. Please pick today or a future date.', true);
      return;
    }
    if (editFormData.reservation_date === todayStr) {
      const nowTimeStr = getCurrentTimeString();
      if (editFormData.reservation_time < nowTimeStr) {
        showToast('Cannot update reservation to a past time today. Please pick an upcoming time.', true);
        return;
      }
    }

    try {
      setIsSubmittingEdit(true);
      const res = await fetch(`/api/admin/reservations/${editingRes.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update reservation');
      }

      // Optimistic update
      setReservations(prev => prev.map(r => r.id === editingRes.id ? {
        ...r,
        ...data.reservation,
        users: {
          ...(r.users || {}),
          full_name: editFormData.customer_name,
          phone_number: editFormData.phone_number,
          email: editFormData.email
        }
      } : r));

      setEditModalOpen(false);
      setEditingRes(null);
      showToast(`✓ Reservation #${String(editingRes.id).slice(0, 8)} updated successfully!`);
      fetchReservations();
      fetchTables();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  // ── CRUD: DELETE HANDLER ──
  function openDeleteModal(res) {
    setDeletingRes(res);
    setDeleteModalOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingRes) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/admin/reservations/${deletingRes.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete reservation');
      }

      setReservations(prev => prev.filter(r => r.id !== deletingRes.id));
      setDeleteModalOpen(false);
      setDeletingRes(null);
      showToast(`✓ Reservation deleted and table released!`);
      fetchTables();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setIsDeleting(false);
    }
  }

  // ── QUICK STATUS UPDATE HANDLER ──
  async function updateStatus(id, newStatus) {
    if (newStatus === 'cancelled') {
      const res = reservations.find(r => r.id === id);
      if (res) {
        openCancelModal(res);
        return;
      }
    }

    try {
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      const res = await fetch(`/api/admin/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update status');
      }
      showToast(`✓ Status updated to ${newStatus.toUpperCase()}`);
      fetchReservations();
      fetchTables();
    } catch (err) {
      showToast(err.message, true);
      fetchReservations();
    }
  }

  // ── HOTLINE CANCEL HANDLER ──
  function openCancelModal(res) {
    setSelectedResForCancel(res);
    setCancelReason('Customer called hotline (>10m policy)');
    setStaffNote('');
    setCancelModalOpen(true);
  }

  async function handleConfirmCancel() {
    if (!selectedResForCancel) return;
    const targetId = selectedResForCancel.id;
    const targetGuest = selectedResForCancel.users?.full_name || 'Guest';

    const noteToSave = staffNote.trim()
      ? `[Cancelled: ${cancelReason}] ${staffNote.trim()}`
      : `[Cancelled via Hotline: ${cancelReason}]`;

    setCancelModalOpen(false);
    setSelectedResForCancel(null);

    setReservations(prev => prev.map(r => r.id === targetId ? {
      ...r,
      status: 'cancelled',
      admin_reply: noteToSave
    } : r));

    showToast(`✓ Booking for ${targetGuest} cancelled via Hotline.`);

    try {
      await fetch(`/api/admin/reservations/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          admin_reply: noteToSave,
          cancel_reason: cancelReason,
          staff_note: staffNote.trim()
        })
      });
      fetchReservations();
      fetchTables();
    } catch (err) {
      console.error('Error syncing cancel:', err);
      fetchReservations();
    }
  }

  // ── REPLY MODAL HANDLER ──
  function openReplyModal(res) {
    setSelectedResForReply(res);
    setReplyText(res.admin_reply || '');
    setReplyModalOpen(true);
  }

  async function handleSaveReply() {
    if (!selectedResForReply) return;
    const targetId = selectedResForReply.id;
    const trimmed = replyText.trim();

    setReplyModalOpen(false);
    setSelectedResForReply(null);

    setReservations(prev => prev.map(r => r.id === targetId ? {
      ...r,
      admin_reply: trimmed || null
    } : r));

    showToast('✓ Staff reply note saved!');

    try {
      await fetch(`/api/admin/reservations/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedResForReply.status,
          admin_reply: trimmed || null
        })
      });
      fetchReservations();
    } catch (err) {
      console.error('Error saving reply:', err);
      fetchReservations();
    }
  }

  // ── SUMMARY STATISTICS ──
  const stats = useMemo(() => {
    let total = reservations.length;
    let confirmed = 0;
    let inGrace = 0;
    let hotlineRequired = 0;
    let cancelled = 0;
    let completed = 0;

    reservations.forEach(r => {
      if (r.status === 'confirmed') confirmed++;
      if (r.status === 'cancelled') cancelled++;
      if (r.status === 'completed') completed++;
      if (r.status !== 'cancelled' && r.status !== 'completed') {
        if (isWithinGracePeriod(r.created_at, currentTime)) {
          inGrace++;
        } else {
          hotlineRequired++;
        }
      }
    });

    return { total, confirmed, inGrace, hotlineRequired, cancelled, completed };
  }, [reservations, currentTime]);

  // ── FILTERED RESERVATIONS ──
  const filteredReservations = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    return reservations.filter(r => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const guestName = (r.users?.full_name || '').toLowerCase();
        const phone = (r.users?.phone_number || '').toLowerCase();
        const email = (r.users?.email || '').toLowerCase();
        const table = (r.restaurant_tables?.table_number?.toString() || '').toLowerCase();
        const requests = (r.special_requests || '').toLowerCase();
        const reply = (r.admin_reply || '').toLowerCase();
        const matches = guestName.includes(q) || phone.includes(q) || email.includes(q) || table.includes(q) || requests.includes(q) || reply.includes(q);
        if (!matches) return false;
      }

      // 2. Date Horizon Filter
      if (dateFilter === 'TODAY' && r.reservation_date !== todayStr) return false;
      if (dateFilter === 'TOMORROW' && r.reservation_date !== tomorrowStr) return false;
      if (dateFilter === 'UPCOMING' && r.reservation_date < todayStr) return false;
      if (dateFilter === 'PAST' && r.reservation_date >= todayStr) return false;

      // 3. Status Filter
      if (statusFilter === 'CONFIRMED' && r.status !== 'confirmed') return false;
      if (statusFilter === 'PENDING' && r.status !== 'pending') return false;
      if (statusFilter === 'CANCELLED' && r.status !== 'cancelled') return false;
      if (statusFilter === 'COMPLETED' && r.status !== 'completed') return false;
      if (statusFilter === 'GRACE_PERIOD') {
        if (r.status === 'cancelled' || r.status === 'completed' || !isWithinGracePeriod(r.created_at, currentTime)) return false;
      }
      if (statusFilter === 'HOTLINE_REQUIRED') {
        if (r.status === 'cancelled' || r.status === 'completed' || isWithinGracePeriod(r.created_at, currentTime)) return false;
      }

      return true;
    });
  }, [reservations, searchQuery, statusFilter, dateFilter, currentTime]);

  return (
    <div style={{ padding: '4px 0 40px 0', minHeight: '100vh' }}>
      {/* ── FLOATING TOAST ── */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: toastMessage.isError ? '#dc2626' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          fontWeight: 700,
          fontSize: '13px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeInDown 0.25s ease-out'
        }}>
          {toastMessage.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ── 1. LUXURY TOP HEADER & ACTION BAR ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(250,248,245,0.98) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(184, 127, 92, 0.20)',
        borderRadius: '18px',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px -2px rgba(184, 127, 92, 0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Title and Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(184, 127, 92, 0.16) 0%, rgba(212, 175, 55, 0.16) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            boxShadow: '0 2px 8px rgba(184, 127, 92, 0.12)'
          }}>
            <Calendar size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
              Table Reservations Desk
            </h1>
            <p style={{ margin: '3px 0 0 0', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              VIP bookings, dining allocations, table management & hotline policy desk
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Official Hotline Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '10px',
            background: '#ffffff',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <PhoneCall size={14} color="var(--primary)" />
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {RESTAURANT_HOTLINE}
            </div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              fontWeight: 700,
              color: '#059669',
              background: 'rgba(16, 185, 129, 0.12)',
              padding: '2px 6px',
              borderRadius: '6px'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
              24/7
            </span>
          </div>

          {/* Sync / Refresh */}
          <button
            onClick={fetchReservations}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid var(--border)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} color="var(--primary)" />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {/* CREATE NEW RESERVATION BUTTON (CRUD CREATE) */}
          <button
            onClick={openCreateModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #9c6848 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(184, 127, 92, 0.28)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={16} />
            <span>New Reservation</span>
          </button>
        </div>
      </div>

      {/* ── 2. FIVE EXECUTIVE LUXURY KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {/* Card 1: Total Bookings */}
        <div style={{
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #ffffff 0%, #faf8f5 100%)',
          border: '1px solid rgba(184, 127, 92, 0.22)',
          boxShadow: '0 4px 14px rgba(184, 127, 92, 0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Bookings
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {stats.total}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(184, 127, 92, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            All guest reservations recorded
          </div>
        </div>

        {/* Card 2: Confirmed Bookings */}
        <div style={{
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Confirmed
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {stats.confirmed}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(16, 185, 129, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#059669', marginTop: '6px', fontWeight: 600 }}>
            ✓ Ready & allocated tables
          </div>
        </div>

        {/* Card 3: In Grace Period (<10m) */}
        <div style={{
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🟢 Grace Period (&lt;10m)
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {stats.inGrace}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(16, 185, 129, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#047857', marginTop: '6px', fontWeight: 600 }}>
            Customer self-cancel active in app
          </div>
        </div>

        {/* Card 4: Hotline Required (>10m) */}
        <div style={{
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
          border: '1px solid rgba(249, 115, 22, 0.25)',
          boxShadow: '0 4px 14px rgba(249, 115, 22, 0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📞 Hotline Required
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#ea580c', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {stats.hotlineRequired}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(249, 115, 22, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <PhoneCall size={18} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#c2410c', marginTop: '6px', fontWeight: 600 }}>
            Locked; calls routed to desk
          </div>
        </div>

        {/* Card 5: Cancelled */}
        <div style={{
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: '0 4px 14px rgba(239, 68, 68, 0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Cancelled
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {stats.cancelled}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
              <Ban size={18} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '6px', fontWeight: 600 }}>
            Released back to floor
          </div>
        </div>
      </div>

      {/* ── 3. POLICY INFORMATION NOTICE ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '14px 20px',
        marginBottom: '20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'rgba(184, 127, 92, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary)',
          flexShrink: 0
        }}>
          <Clock size={16} />
        </div>
        <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          <strong style={{ color: 'var(--text-primary)' }}>10-Minute Policy & Cancellation Protocol:</strong> Guests can self-cancel via the mobile app within the first 10 minutes.
          After 10 minutes, self-cancel is locked and callers are directed to the <strong>Hotline ({RESTAURANT_HOTLINE})</strong>. Staff can adjust tables, modify details, or cancel with a logged reason below.
        </div>
      </div>

      {/* ── 4. FILTER TABS & SEARCH BAR ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Status Filter Tabs */}
        <div style={{
          display: 'inline-flex',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '10px',
          gap: '4px',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'ALL', label: 'All', count: stats.total },
            { id: 'CONFIRMED', label: 'Confirmed', count: stats.confirmed, color: '#047857' },
            { id: 'GRACE_PERIOD', label: '🟢 Grace (<10m)', count: stats.inGrace, color: '#059669' },
            { id: 'HOTLINE_REQUIRED', label: '📞 Hotline (>10m)', count: stats.hotlineRequired, color: '#ea580c' },
            { id: 'PENDING', label: 'Pending', count: reservations.filter(r => r.status === 'pending').length, color: '#b45309' },
            { id: 'CANCELLED', label: 'Cancelled', count: stats.cancelled, color: '#dc2626' },
            { id: 'COMPLETED', label: 'Completed', count: stats.completed, color: '#475569' }
          ].map(tab => {
            const isSel = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.80rem',
                  fontWeight: isSel ? 700 : 500,
                  background: isSel ? '#ffffff' : 'transparent',
                  color: isSel ? (tab.color || '#0f172a') : '#64748b',
                  border: 'none',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isSel ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  background: isSel ? 'rgba(0,0,0,0.06)' : '#e2e8f0',
                  color: isSel ? (tab.color || '#0f172a') : '#64748b',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.70rem',
                  fontWeight: 700
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Date Filter + Search Box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Date Horizon Pills */}
          <div style={{ display: 'flex', gap: '4px', background: '#f8fafc', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {[
              { id: 'ALL', label: 'All Dates' },
              { id: 'TODAY', label: 'Today' },
              { id: 'TOMORROW', label: 'Tomorrow' },
              { id: 'UPCOMING', label: 'Upcoming' },
              { id: 'PAST', label: 'Past' }
            ].map(d => {
              const isSel = dateFilter === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDateFilter(d.id)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: isSel ? 700 : 500,
                    borderRadius: '6px',
                    border: 'none',
                    background: isSel ? 'var(--primary)' : 'transparent',
                    color: isSel ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search
              size={14}
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
              placeholder="Search guest, phone, table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '32px',
                paddingRight: searchQuery ? '28px' : '10px',
                paddingTop: '7px',
                paddingBottom: '7px',
                fontSize: '0.82rem',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                color: '#0f172a'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '2px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 5. RESERVATIONS LUXURY DATA TABLE ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 18px rgba(0,0,0,0.03)'
      }}>
        {/* Table Top Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Reservations Ledger
            </h3>
            <span style={{
              background: 'rgba(184, 127, 92, 0.12)',
              color: 'var(--primary)',
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              {filteredReservations.length} records
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {filteredReservations.length} of {reservations.length} bookings
          </div>
        </div>

        {/* Fixed Width Table (Zero horizontal scroll) */}
        <div style={{ width: '100%', overflowX: 'hidden' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <th style={{ width: '19%', padding: '12px 14px', fontWeight: 700 }}>Guest / Customer</th>
                <th style={{ width: '13%', padding: '12px 14px', fontWeight: 700 }}>Schedule</th>
                <th style={{ width: '10%', padding: '12px 14px', fontWeight: 700 }}>Table & Pax</th>
                <th style={{ width: '12%', padding: '12px 14px', fontWeight: 700 }}>10-Min Policy</th>
                <th style={{ width: '8%', padding: '12px 10px', fontWeight: 700, textAlign: 'center' }}>Note</th>
                <th style={{ width: '14%', padding: '12px 10px', fontWeight: 700, textAlign: 'center' }}>Status</th>
                <th style={{ width: '24%', padding: '12px 14px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={24} className="animate-spin" color="var(--primary)" />
                      <span>Loading reservations ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredReservations.length > 0 ? (
                filteredReservations.map((r, idx) => {
                  const elapsedMins = getElapsedMinutes(r.created_at, currentTime);
                  const inGrace = isWithinGracePeriod(r.created_at, currentTime);
                  const isCancelled = r.status === 'cancelled';
                  const isCompleted = r.status === 'completed';
                  const guestName = r.users?.full_name || 'Walk-in Guest';
                  const initials = guestName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'G';

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#fafbfc'}
                    >
                      {/* 1. Guest / Customer */}
                      <td style={{ padding: '12px 14px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, rgba(184, 127, 92, 0.18) 0%, rgba(212, 175, 55, 0.18) 100%)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '11px',
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {guestName}
                            </div>
                            {r.users?.phone_number ? (
                              <a
                                href={`tel:${r.users.phone_number}`}
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--primary)',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  textDecoration: 'none',
                                  marginTop: '1px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                <Phone size={10} />
                                <span>{r.users.phone_number}</span>
                              </a>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>No phone recorded</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Date & Schedule */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {formatReservationDate(r.reservation_date)}
                        </div>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0284c7',
                          background: '#e0f2fe',
                          padding: '2px 6px',
                          borderRadius: '5px',
                          marginTop: '3px'
                        }}>
                          <Clock size={10} />
                          <span>{formatReservationTime(r.reservation_time)}</span>
                        </div>
                      </td>

                      {/* 3. Table & Pax */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: '5px',
                          background: r.restaurant_tables?.table_number ? 'rgba(184, 127, 92, 0.12)' : '#f1f5f9',
                          color: r.restaurant_tables?.table_number ? 'var(--primary)' : '#64748b',
                          fontWeight: 800,
                          fontSize: '11px',
                          display: 'inline-block'
                        }}>
                          {r.restaurant_tables?.table_number ? `Table ${r.restaurant_tables.table_number}` : 'Unassigned'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#64748b', marginTop: '3px', fontWeight: 600 }}>
                          <Users size={11} />
                          <span>{r.pax || 2} Guests</span>
                        </div>
                      </td>

                      {/* 4. 10-Min Policy Status */}
                      <td style={{ padding: '12px 14px' }}>
                        {isCancelled ? (
                          <div>
                            <span style={{
                              fontSize: '11px',
                              color: r.admin_reply?.includes('Hotline') ? '#c2410c' : r.admin_reply?.includes('Self') ? '#059669' : '#dc2626',
                              background: r.admin_reply?.includes('Hotline') ? '#ffedd5' : r.admin_reply?.includes('Self') ? '#ecfdf5' : '#fee2e2',
                              border: `1px solid ${r.admin_reply?.includes('Hotline') ? '#fed7aa' : r.admin_reply?.includes('Self') ? '#a7f3d0' : '#fecaca'}`,
                              padding: '2px 7px',
                              borderRadius: '5px',
                              fontWeight: 700,
                              display: 'inline-block'
                            }}>
                              {r.admin_reply?.includes('Hotline') ? '📞 Cancelled (Hotline)' : r.admin_reply?.includes('Self') ? '📱 Cancelled (Self <10m)' : 'Cancelled'}
                            </span>
                            {r.admin_reply && (
                              <div
                                style={{
                                  fontSize: '10px',
                                  color: '#64748b',
                                  marginTop: '2px',
                                  maxWidth: '180px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={r.admin_reply}
                              >
                                {r.admin_reply.replace(/^\[|\]$/g, '')}
                              </div>
                            )}
                          </div>
                        ) : isCompleted ? (
                          <span style={{ fontSize: '11px', color: '#475569', background: '#f1f5f9', padding: '2px 7px', borderRadius: '5px', fontWeight: 700, display: 'inline-block' }}>
                            Completed
                          </span>
                        ) : inGrace ? (
                          <div>
                            <span style={{
                              fontSize: '11px',
                              background: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              padding: '2px 7px',
                              borderRadius: '5px',
                              fontWeight: 700,
                              display: 'inline-block'
                            }}>
                              🟢 Grace ({Math.max(0, 10 - elapsedMins)}m left)
                            </span>
                            <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '2px' }}>
                              In-app cancel active
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span style={{
                              fontSize: '11px',
                              background: '#ffedd5',
                              color: '#c2410c',
                              border: '1px solid #fed7aa',
                              padding: '2px 7px',
                              borderRadius: '5px',
                              fontWeight: 700,
                              display: 'inline-block'
                            }}>
                              📞 Hotline Req.
                            </span>
                            <div style={{ fontSize: '10px', color: '#ea580c', marginTop: '2px' }}>
                              {elapsedMins >= 60 ? `${Math.floor(elapsedMins/60)}h ago` : `${elapsedMins}m ago`}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 5. Special Requests & Notes (CLICKABLE CLEAN PILL) */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {(r.special_requests || r.admin_reply) ? (
                          <button
                            onClick={() => openViewNoteModal(r)}
                            title="Click to view full notes and special requests"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 9px',
                              borderRadius: '7px',
                              background: r.admin_reply ? 'rgba(184, 127, 92, 0.12)' : '#f1f5f9',
                              border: `1px solid ${r.admin_reply ? 'rgba(184, 127, 92, 0.3)' : '#cbd5e1'}`,
                              color: r.admin_reply ? 'var(--primary)' : '#475569',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <MessageSquare size={12} color={r.admin_reply ? 'var(--primary)' : '#64748b'} />
                            <span>View Note</span>
                          </button>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '13px' }}>—</span>
                        )}
                      </td>

                      {/* 6. Status Badge */}
                      {/* 6. Status Column (Interactive Luxury Badge Dropdown) */}
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <select
                            value={r.status}
                            onChange={(e) => updateStatus(r.id, e.target.value)}
                            title="Click to change status"
                            style={{
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              padding: '5px 22px 5px 12px',
                              borderRadius: '16px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              letterSpacing: '0.4px',
                              background: r.status === 'confirmed' ? '#dcfce7' : r.status === 'pending' ? '#fef3c7' : r.status === 'cancelled' ? '#fee2e2' : '#f1f5f9',
                              color: r.status === 'confirmed' ? '#15803d' : r.status === 'pending' ? '#b45309' : r.status === 'cancelled' ? '#dc2626' : '#475569',
                              border: `1px solid ${r.status === 'confirmed' ? '#bbf7d0' : r.status === 'pending' ? '#fde68a' : r.status === 'cancelled' ? '#fecaca' : '#e2e8f0'}`,
                              cursor: 'pointer',
                              outline: 'none',
                              textTransform: 'uppercase'
                            }}
                          >
                            <option value="confirmed" style={{ background: '#ffffff', color: '#15803d' }}>● CONFIRMED</option>
                            <option value="pending" style={{ background: '#ffffff', color: '#b45309' }}>● PENDING</option>
                            <option value="completed" style={{ background: '#ffffff', color: '#475569' }}>● COMPLETED</option>
                            <option value="cancelled" style={{ background: '#ffffff', color: '#dc2626' }}>● CANCELLED</option>
                          </select>
                          <ChevronDown size={11} style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: r.status === 'confirmed' ? '#15803d' : r.status === 'pending' ? '#b45309' : r.status === 'cancelled' ? '#dc2626' : '#475569' }} />
                        </div>
                      </td>

                      {/* 7. Action Buttons (EDIT, HOTLINE, DELETE) */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', flexWrap: 'nowrap' }}>
                          {/* EDIT BUTTON (CRUD UPDATE) */}
                          <button
                            onClick={() => openEditModal(r)}
                            title="Edit Reservation Details"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>

                          {/* HOTLINE CANCELLATION BUTTON */}
                          {!isCancelled && !isCompleted && (
                            <button
                              onClick={() => openCancelModal(r)}
                              title="Process Hotline Cancellation"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: '#fff7ed',
                                border: '1px solid #fed7aa',
                                color: '#c2410c',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <PhoneCall size={12} />
                              <span>Hotline</span>
                            </button>
                          )}

                          {/* DELETE BUTTON (CRUD DELETE) */}
                          <button
                            onClick={() => openDeleteModal(r)}
                            title="Delete Reservation Permanently"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 9px',
                              borderRadius: '6px',
                              background: '#fee2e2',
                              border: '1px solid #fca5a5',
                              color: '#b91c1c',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={32} color="#cbd5e1" />
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>No Reservations Found</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>No records match your selected date or status filters.</div>
                      <button
                        onClick={openCreateModal}
                        style={{
                          marginTop: '8px',
                          padding: '7px 16px',
                          borderRadius: '8px',
                          background: 'var(--primary)',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        + Create First Reservation
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 1: CREATE NEW RESERVATION (CRUD CREATE) ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {createModalOpen && (
        <div
          onClick={() => setCreateModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
              animation: 'fadeInUp 0.2s ease-out'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #f1f5f9',
              background: 'linear-gradient(135deg, #faf8f5 0%, #ffffff 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(184, 127, 92, 0.14)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    New Table Reservation
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Book a dining experience & allocate table
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateReservation} style={{ padding: '22px 24px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* Customer Name */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Customer / Guest Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Achintha Edirisinghe"
                    value={newResData.customer_name}
                    onChange={(e) => setNewResData({ ...newResData, customer_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +94 77 123 4567"
                    value={newResData.phone_number}
                    onChange={(e) => setNewResData({ ...newResData, phone_number: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. guest@example.com"
                    value={newResData.email}
                    onChange={(e) => setNewResData({ ...newResData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Reservation Date <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={getTodayDateString()}
                    value={newResData.reservation_date}
                    onChange={(e) => setNewResData({ ...newResData, reservation_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Time */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Reservation Time <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={newResData.reservation_time}
                    onChange={(e) => setNewResData({ ...newResData, reservation_time: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Pax / Guests */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Guests (Pax)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setNewResData(d => ({ ...d, pax: Math.max(1, d.pax - 1) }))}
                      style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 800, cursor: 'pointer' }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={newResData.pax}
                      onChange={(e) => setNewResData({ ...newResData, pax: parseInt(e.target.value, 10) || 1 })}
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        padding: '9px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        fontWeight: 700
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setNewResData(d => ({ ...d, pax: d.pax + 1 }))}
                      style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 800, cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Assign Table */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Assign Restaurant Table
                  </label>
                  <select
                    value={newResData.table_id}
                    onChange={(e) => setNewResData({ ...newResData, table_id: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#ffffff'
                    }}
                  >
                    <option value="">Walk-in / Unassigned</option>
                    {tablesList.map(t => (
                      <option key={t.id} value={t.id}>
                        Table {t.table_number} ({t.capacity} seats) - {t.status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Special Requests */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Special Requests / Dietary / VIP Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Anniversary dinner, window view requested, gluten-free preference"
                    value={newResData.special_requests}
                    onChange={(e) => setNewResData({ ...newResData, special_requests: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'none'
                    }}
                  />
                </div>

                {/* Status */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Initial Status
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {['confirmed', 'pending'].map(st => (
                      <label key={st} style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px',
                        borderRadius: '8px',
                        border: newResData.status === st ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                        background: newResData.status === st ? 'rgba(184, 127, 92, 0.08)' : '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '13px',
                        textTransform: 'capitalize'
                      }}>
                        <input
                          type="radio"
                          name="new_status"
                          value={st}
                          checked={newResData.status === st}
                          onChange={(e) => setNewResData({ ...newResData, status: e.target.value })}
                          style={{ display: 'none' }}
                        />
                        {st === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #9c6848 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(184, 127, 92, 0.25)'
                  }}
                >
                  {isSubmittingCreate ? 'Creating Booking...' : 'Create Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 2: EDIT RESERVATION (CRUD UPDATE) ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {editModalOpen && editingRes && (
        <div
          onClick={() => setEditModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
              animation: 'fadeInUp 0.2s ease-out'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #f1f5f9',
              background: 'linear-gradient(135deg, #faf8f5 0%, #ffffff 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(184, 127, 92, 0.14)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Edit Reservation Details
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Order #{String(editingRes.id).slice(0, 8)} • Table {editingRes.restaurant_tables?.table_number ?? 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} style={{ padding: '22px 24px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* Guest Name */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Customer / Guest Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.customer_name}
                    onChange={(e) => setEditFormData({ ...editFormData, customer_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phone_number}
                    onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Reservation Date <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={getTodayDateString()}
                    value={editFormData.reservation_date}
                    onChange={(e) => setEditFormData({ ...editFormData, reservation_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Time */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Reservation Time <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={editFormData.reservation_time}
                    onChange={(e) => setEditFormData({ ...editFormData, reservation_time: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Pax */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Guests (Pax)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={editFormData.pax}
                    onChange={(e) => setEditFormData({ ...editFormData, pax: parseInt(e.target.value, 10) || 1 })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700
                    }}
                  />
                </div>

                {/* Table */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Assigned Table
                  </label>
                  <select
                    value={editFormData.table_id}
                    onChange={(e) => setEditFormData({ ...editFormData, table_id: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#ffffff'
                    }}
                  >
                    <option value="">Walk-in / Unassigned</option>
                    {tablesList.map(t => (
                      <option key={t.id} value={t.id}>
                        Table {t.table_number} ({t.capacity} seats)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Reservation Status
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                      background: '#ffffff'
                    }}
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Special Requests */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Special Requests
                  </label>
                  <textarea
                    rows={2}
                    value={editFormData.special_requests}
                    onChange={(e) => setEditFormData({ ...editFormData, special_requests: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #9c6848 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(184, 127, 92, 0.25)'
                  }}
                >
                  {isSubmittingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 3: DELETE CONFIRMATION MODAL (CRUD DELETE) ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {deleteModalOpen && deletingRes && (
        <div
          onClick={() => setDeleteModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              animation: 'fadeInUp 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Delete Reservation Record?
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  This action permanently removes the booking from database
                </p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '18px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Guest Name:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{deletingRes.users?.full_name || 'Guest'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Schedule:</span>
                <span>{deletingRes.reservation_date} at {deletingRes.reservation_time?.slice(0, 5)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Table & Pax:</span>
                <span>Table {deletingRes.restaurant_tables?.table_number ?? 'Unassigned'} ({deletingRes.pax} Guests)</span>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.4 }}>
              Deleting this record will immediately release Table {deletingRes.restaurant_tables?.table_number ?? ''} back to available status.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Keep Reservation
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.28)'
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 4: HOTLINE CANCELLATION MODAL ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {cancelModalOpen && selectedResForCancel && (
        <div
          onClick={() => {
            setCancelModalOpen(false);
            setSelectedResForCancel(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              animation: 'fadeInUp 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#fee2e2', padding: '9px', borderRadius: '10px', color: '#dc2626' }}>
                  <PhoneCall size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Process Hotline Cancellation
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Record cancellation details requested via Hotline ({RESTAURANT_HOTLINE})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCancelModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Reservation Summary */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Guest:</span>
                <strong>{selectedResForCancel.users?.full_name || 'Guest'} ({selectedResForCancel.users?.phone_number || 'No phone'})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Table & Pax:</span>
                <span>Table {selectedResForCancel.restaurant_tables?.table_number ?? 'Unassigned'} • {selectedResForCancel.pax} Guests</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Scheduled For:</span>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                  {selectedResForCancel.reservation_date} at {selectedResForCancel.reservation_time?.slice(0, 5)}
                </span>
              </div>
            </div>

            {/* Reason Selection */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Cancellation Reason
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff' }}
              >
                <option value="Customer called hotline (>10m policy)">Customer called hotline (&gt;10m policy)</option>
                <option value="Customer requested cancellation over phone">Customer requested cancellation over phone</option>
                <option value="Customer flight delayed / travel issue">Customer flight delayed / travel issue</option>
                <option value="Illness / medical emergency">Illness / medical emergency</option>
                <option value="No-show / unable to reach customer">No-show / unable to reach customer</option>
                <option value="Double booking / customer error">Double booking / customer error</option>
                <option value="Restaurant operational issue">Restaurant operational issue</option>
                <option value="Other">Other reason (specified in notes)</option>
              </select>
            </div>

            {/* Staff Note */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Staff Internal Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Caller spoke with Manager Achintha, offered reschedule for next Friday"
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', resize: 'none' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.28)'
                }}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 5: REPLY / STAFF NOTE MODAL ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {replyModalOpen && selectedResForReply && (
        <div
          onClick={() => {
            setReplyModalOpen(false);
            setSelectedResForReply(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              animation: 'fadeInUp 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(184, 127, 92, 0.14)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Staff Reply / Booking Note
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    For {selectedResForReply.users?.full_name || 'Guest'} (Table {selectedResForReply.restaurant_tables?.table_number ?? 'N/A'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReplyModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {selectedResForReply.special_requests && (
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px', fontSize: '12px' }}>
                <span style={{ color: '#64748b' }}>Guest Request: </span>
                <strong style={{ color: 'var(--text-primary)' }}>&ldquo;{selectedResForReply.special_requests}&rdquo;</strong>
              </div>
            )}

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Reply Note / Reason
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Window table arranged with champagne bucket per anniversary request."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setReplyModalOpen(false)}
                style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReply}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #9c6848 100%)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(184, 127, 92, 0.25)'
                }}
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 6: VIEW NOTE & SPECIAL REQUESTS MODAL ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {viewNoteModalOpen && selectedResForNoteView && (
        <div
          onClick={() => setViewNoteModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              animation: 'fadeInUp 0.2s ease-out'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(184, 127, 92, 0.14)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Booking Notes & Requests
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {selectedResForNoteView.users?.full_name || 'Guest'} • Table {selectedResForNoteView.restaurant_tables?.table_number ?? 'Unassigned'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewNoteModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Customer Request Section */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Customer Special Request:
              </div>
              {selectedResForNoteView.special_requests ? (
                <div style={{
                  background: '#faf8f5',
                  border: '1px solid rgba(184, 127, 92, 0.2)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  fontStyle: 'italic',
                  lineHeight: 1.5
                }}>
                  &ldquo;{selectedResForNoteView.special_requests}&rdquo;
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>No special requests from guest.</div>
              )}
            </div>

            {/* Staff Reply / Reason Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Staff Note / Cancellation Reason:
              </div>
              {selectedResForNoteView.admin_reply ? (
                <div style={{
                  background: selectedResForNoteView.status === 'cancelled' ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${selectedResForNoteView.status === 'cancelled' ? '#fecaca' : '#bbf7d0'}`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: selectedResForNoteView.status === 'cancelled' ? '#991b1b' : '#166534',
                  lineHeight: 1.5
                }}>
                  {selectedResForNoteView.admin_reply}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>No staff note recorded yet.</div>
              )}
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                onClick={() => {
                  setViewNoteModalOpen(false);
                  openReplyModal(selectedResForNoteView);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--primary)',
                  background: 'rgba(184, 127, 92, 0.08)',
                  color: 'var(--primary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ✏️ Edit Staff Note
              </button>

              <button
                type="button"
                onClick={() => setViewNoteModalOpen(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
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
