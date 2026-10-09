"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { API_BASE } from '../../lib/api';

function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
  } catch {
    // AudioContext blocked or unsupported
  }
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function QueuePage() {
  const [data, setData] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paxFilter, setPaxFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [now, setNow] = useState(Date.now());

  // ── Modal States ──
  // 1. Walk-In (Create)
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [pax, setPax] = useState(2);
  const [estWait, setEstWait] = useState(15);
  const [seatingPref, setSeatingPref] = useState('Any');
  const [isVip, setIsVip] = useState(false);
  const [needsHighChair, setNeedsHighChair] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false);

  // 2. Edit Party (Update)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPax, setEditPax] = useState(2);
  const [editEstWait, setEditEstWait] = useState(15);
  const [editStatus, setEditStatus] = useState('waiting');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // 3. Delete Confirmation (Delete)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // 4. Assign Table Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Live timer tick every 20 seconds for elapsed wait updates
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(timer);
  }, []);

  async function fetchQueueAndTables(isManual = false) {
    if (isManual) setRefreshing(true);
    try {
      let queueItems = null;

      // 1. Try Backend API first (bypasses RLS with supabaseAdmin)
      try {
        const res = await fetch(`${API_BASE}/api/queue`);
        if (res.ok) {
          queueItems = await res.json();
        }
      } catch (err) {
        console.warn('Backend /api/queue failed, trying direct Supabase:', err);
      }

      // 2. Fallback to Supabase directly (without email column to avoid permission issues)
      if (!queueItems) {
        const { data: qData, error: qErr } = await supabase
          .from('queue_entries')
          .select('*, users(full_name, phone_number)')
          .order('joined_at', { ascending: true });

        if (qErr) console.error('Supabase queue fetch error:', qErr);
        if (qData) queueItems = qData;
      }

      const { data: tData, error: tErr } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number', { ascending: true });

      if (tErr) console.error('Supabase tables fetch error:', tErr);

      if (queueItems) setData(queueItems);
      if (tData) setTables(tData);
    } catch (e) {
      console.error('Error fetching queue or tables:', e);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchQueueAndTables();

    // 4-second auto-poll backup in case WebSockets fail or throttle
    const pollInterval = setInterval(() => {
      fetchQueueAndTables();
    }, 4000);

    const queueChannel = supabase.channel('admin_queue_realtime_full').on('postgres_changes',
      { event: '*', schema: 'public', table: 'queue_entries' },
      () => { fetchQueueAndTables(); }
    ).subscribe();

    const tablesChannel = supabase.channel('admin_tables_realtime_full').on('postgres_changes',
      { event: '*', schema: 'public', table: 'restaurant_tables' },
      () => { fetchQueueAndTables(); }
    ).subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(tablesChannel);
    };
  }, []);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  // ── 1. CREATE: Handle Walk-In Creation ──
  async function handleAddWalkIn(e) {
    e.preventDefault();
    setIsSubmittingWalkIn(true);
    try {
      const cleanPhone = guestPhone.replace(/\D/g, '').slice(0, 10);
      const res = await fetch(`${API_BASE}/api/queue/walk-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guestName.trim() || 'Walk-In Guest',
          phone_number: cleanPhone || null,
          pax: parseInt(pax) || 2,
          estimated_wait_time_mins: parseInt(estWait) || 15
        })
      });

      if (res.ok) {
        showToast('✅ Walk-In party added to waitlist successfully!');
        setWalkInModalOpen(false);
        resetWalkInForm();
        fetchQueueAndTables();
      } else {
        // Fallback direct Supabase insert
        const qrToken = 'walkin_' + Date.now();
        await supabase.from('queue_entries').insert({
          pax: parseInt(pax) || 2,
          estimated_wait_time_mins: parseInt(estWait) || 15,
          status: 'waiting',
          qr_code_token: qrToken,
          joined_at: new Date().toISOString()
        });
        showToast('✅ Walk-In party added to waitlist!');
        setWalkInModalOpen(false);
        resetWalkInForm();
        fetchQueueAndTables();
      }
    } catch (err) {
      showToast('❌ Error adding walk-in: ' + err.message);
    } finally {
      setIsSubmittingWalkIn(false);
    }
  }

  function resetWalkInForm() {
    setGuestName('');
    setGuestPhone('');
    setPax(2);
    setEstWait(15);
    setSeatingPref('Any');
    setIsVip(false);
    setNeedsHighChair(false);
    setNotes('');
  }

  // ── 2. UPDATE: Edit Party Details ──
  function openEditModal(item) {
    setEditingItem(item);
    setEditName(item.users?.full_name || 'Walk-In Guest');
    setEditPhone(item.users?.phone_number || '');
    setEditPax(item.pax || 2);
    setEditEstWait(item.estimated_wait_time_mins || 15);
    setEditStatus(item.status || 'waiting');
    setEditModalOpen(true);
  }

  async function handleConfirmEdit(e) {
    e.preventDefault();
    if (!editingItem) return;
    setIsSubmittingEdit(true);
    try {
      const cleanPhone = editPhone.replace(/\D/g, '').slice(0, 10);
      const res = await fetch(`${API_BASE}/api/queue/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: editName.trim() || 'Walk-In Guest',
          phone_number: cleanPhone || null,
          pax: parseInt(editPax) || 2,
          estimated_wait_time_mins: parseInt(editEstWait) || 15,
          status: editStatus
        })
      });

      if (res.ok) {
        showToast('✅ Party details updated successfully!');
      } else {
        // Fallback direct Supabase update
        await supabase.from('queue_entries').update({
          pax: parseInt(editPax) || 2,
          estimated_wait_time_mins: parseInt(editEstWait) || 15,
          status: editStatus
        }).eq('id', editingItem.id);

        if (editingItem.user_id) {
          await supabase.from('users').update({
            full_name: editName.trim() || 'Walk-In Guest',
            phone_number: cleanPhone || null
          }).eq('id', editingItem.user_id);
        }
        showToast('✅ Party details updated!');
      }

      setEditModalOpen(false);
      setEditingItem(null);
      fetchQueueAndTables();
    } catch (err) {
      showToast('❌ Error updating entry: ' + err.message);
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  // ── 3. DELETE: Remove Queue Entry ──
  function openDeleteModal(item) {
    setDeletingItem(item);
    setDeleteModalOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingItem) return;
    setIsSubmittingDelete(true);
    try {
      const res = await fetch(`${API_BASE}/api/queue/${deletingItem.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        showToast('🗑️ Queue entry removed from waitlist.');
      } else {
        // Direct Supabase delete fallback
        await supabase.from('queue_entries').delete().eq('id', deletingItem.id);
        showToast('🗑️ Queue entry removed.');
      }

      setDeleteModalOpen(false);
      setDeletingItem(null);
      fetchQueueAndTables();
    } catch (err) {
      showToast('❌ Error deleting entry: ' + err.message);
    } finally {
      setIsSubmittingDelete(false);
    }
  }

  async function handleMarkAsCancelled() {
    if (!deletingItem) return;
    setIsSubmittingDelete(true);
    try {
      await updateStatus(deletingItem.id, 'cancelled');
      showToast('🏷️ Entry marked as Cancelled.');
      setDeleteModalOpen(false);
      setDeletingItem(null);
    } catch (err) {
      showToast('❌ Error: ' + err.message);
    } finally {
      setIsSubmittingDelete(false);
    }
  }

  // Fast Status Toggle
  async function updateStatus(id, newStatus) {
    try {
      await fetch(`${API_BASE}/api/queue/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchQueueAndTables();
    } catch {
      await supabase.from('queue_entries').update({ status: newStatus }).eq('id', id);
      fetchQueueAndTables();
    }
  }

  // Notify Ready with Sound & Push
  async function handleNotifyGuest(item) {
    playNotificationSound();
    showToast(`🔔 Notifying ${item.users?.full_name || 'Guest'}...`);
    try {
      const res = await fetch(`${API_BASE}/api/queue/${item.id}/notify`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast(`📲 Call notification sent to ${item.users?.full_name || 'Guest'}!`);
      } else {
        await updateStatus(item.id, 'notified');
        showToast(`🔔 Status changed to NOTIFIED.`);
      }
      fetchQueueAndTables();
    } catch {
      await updateStatus(item.id, 'notified');
      fetchQueueAndTables();
    }
  }

  // Direct Table Assignment
  function openAssignModal(queueItem) {
    setSelectedQueueItem(queueItem);
    // Best fit: table with capacity >= pax, smallest first
    const fitTables = tables
      .filter(t => t.status === 'available' && (t.capacity || 4) >= queueItem.pax)
      .sort((a, b) => (a.capacity || 4) - (b.capacity || 4));

    const anyAvailable = fitTables[0] || tables.find(t => t.status === 'available');
    setSelectedTableId(anyAvailable ? String(anyAvailable.id) : '');
    setAssignModalOpen(true);
  }

  async function handleConfirmAssignTable() {
    if (!selectedQueueItem || !selectedTableId) return;
    setIsSubmittingAssign(true);
    try {
      const res = await fetch(`${API_BASE}/api/queue/${selectedQueueItem.id}/assign-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: parseInt(selectedTableId) })
      });

      if (res.ok) {
        showToast('🎉 Table assigned and party seated!');
      } else {
        await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', selectedTableId);
        await supabase.from('queue_entries').update({
          status: 'seated',
          seated_at: new Date().toISOString()
        }).eq('id', selectedQueueItem.id);
        showToast('🎉 Table assigned and party seated!');
      }

      setAssignModalOpen(false);
      setSelectedQueueItem(null);
      fetchQueueAndTables();
    } catch (err) {
      showToast('❌ Error assigning table: ' + err.message);
    } finally {
      setIsSubmittingAssign(false);
    }
  }

  // ── Statistics & Metrics ──
  const stats = useMemo(() => {
    let waiting = 0;
    let notified = 0;
    let seated = 0;
    let cancelled = 0;
    let totalWaitingPax = 0;

    data.forEach(q => {
      const st = (q.status || '').toLowerCase().trim();
      const numPax = parseInt(q.pax) || 2;
      if (st === 'waiting') {
        waiting++;
        totalWaitingPax += numPax;
      } else if (st === 'notified') {
        notified++;
      } else if (st === 'seated') {
        seated++;
      } else if (st === 'cancelled' || st === 'no_show') {
        cancelled++;
      }
    });

    const estAvgWait = waiting > 0 ? Math.round((waiting * 6) + 5) : 0;
    const availableTablesCount = tables.filter(t => (t.status || '').toLowerCase() === 'available').length;
    const totalTablesCount = tables.length || 24;

    return {
      waiting,
      notified,
      seated,
      cancelled,
      totalWaitingPax,
      estAvgWait,
      availableTablesCount,
      totalTablesCount
    };
  }, [data, tables]);

  // ── Filtered & Ordered Queue ──
  const filteredQueue = useMemo(() => {
    let list = [...data];

    // Status filter
    const activeFilter = (statusFilter || 'ALL').toUpperCase();
    if (activeFilter === 'WAITING') list = list.filter(q => (q.status || '').toLowerCase() === 'waiting');
    else if (activeFilter === 'NOTIFIED') list = list.filter(q => (q.status || '').toLowerCase() === 'notified');
    else if (activeFilter === 'SEATED') list = list.filter(q => (q.status || '').toLowerCase() === 'seated');
    else if (activeFilter === 'CLOSED') list = list.filter(q => {
      const s = (q.status || '').toLowerCase();
      return s === 'cancelled' || s === 'no_show';
    });

    // Pax filter
    if (paxFilter === '1-2') list = list.filter(q => (parseInt(q.pax) || 2) <= 2);
    else if (paxFilter === '3-4') list = list.filter(q => (parseInt(q.pax) || 2) === 3 || (parseInt(q.pax) || 2) === 4);
    else if (paxFilter === '5+') list = list.filter(q => (parseInt(q.pax) || 2) >= 5);

    // Search query
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase().trim();
      list = list.filter(q => {
        const name = (q.users?.full_name || 'Walk-In Guest').toLowerCase();
        const phone = (q.users?.phone_number || '').toLowerCase();
        const id = (q.id || '').toLowerCase();
        return name.includes(qLower) || phone.includes(qLower) || id.includes(qLower);
      });
    }

    return list;
  }, [data, statusFilter, paxFilter, searchQuery]);

  // Compute clean sequential queue labels (e.g. W-01, W-02) based on chronological order of waiting items
  const queueIndexMap = useMemo(() => {
    const map = new Map();
    let counter = 1;
    data.forEach(q => {
      if (q.queue_number && q.queue_number > 0) {
        map.set(q.id, `W-${String(q.queue_number).padStart(2, '0')}`);
      } else {
        map.set(q.id, `W-${String(counter).padStart(2, '0')}`);
        counter++;
      }
    });
    return map;
  }, [data]);

  const availableTables = tables.filter(t => t.status === 'available');

  return (
    <div style={{ padding: '6px 0 32px 0' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: '#0f172a',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          zIndex: 9999,
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Top Header & Fast Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
              Live Queue & Host Desk
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '20px',
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '11px',
              fontWeight: '700',
              border: '1px solid rgba(5,150,105,0.2)'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
              Live Sync
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '6px 0 0 0' }}>
            Enterprise waitlist desk: register walk-in parties, adjust pax, seat guests, and manage live table allocations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => fetchQueueAndTables(true)}
            disabled={refreshing}
            style={{
              padding: '9px 15px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: '#ffffff',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
              🔄
            </span>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            onClick={() => setWalkInModalOpen(true)}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--primary)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 10px rgba(184, 127, 92, 0.3)'
            }}
          >
            <span>➕</span> Add Walk-In Party
          </button>
        </div>
      </div>

      {/* ── Real-Time Metrics Overview Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '22px'
      }}>
        {/* Waiting Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>⏳</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Waiting in Queue
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)', lineHeight: 1 }}>
              {stats.waiting}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>
              parties ({stats.totalWaitingPax} guests)
            </span>
          </div>
        </div>

        {/* Notified Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>🔔</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Notified & Ready
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: '800', color: '#2563eb', lineHeight: 1 }}>
              {stats.notified}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>
              called to host desk
            </span>
          </div>
        </div>

        {/* Seated Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>🪑</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Seated Today
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: '800', color: '#059669', lineHeight: 1 }}>
              {stats.seated}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>
              parties accommodated
            </span>
          </div>
        </div>

        {/* Est. Wait & Tables Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>⏱️</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Est. Avg Wait & Tables
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>
              {stats.estAvgWait}m
            </span>
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>
              • {stats.availableTablesCount} tables free
            </span>
          </div>
        </div>
      </div>

      {/* ── Search Bar & Filter Controls ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        padding: '14px 18px',
        border: '1px solid var(--border)',
        marginBottom: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Status Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${data.length})` },
            { id: 'WAITING', label: `Waiting (${stats.waiting})` },
            { id: 'NOTIFIED', label: `Notified (${stats.notified})` },
            { id: 'SEATED', label: `Seated (${stats.seated})` },
            { id: 'CLOSED', label: `Closed (${stats.cancelled})` }
          ].map(tab => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: active ? '700' : '500',
                  border: active ? '1px solid var(--text-primary)' : '1px solid var(--border)',
                  background: active ? 'var(--text-primary)' : '#ffffff',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Pax Filter Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Party Size Selector */}
          <select
            value={paxFilter}
            onChange={(e) => setPaxFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              background: '#ffffff',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Party Sizes</option>
            <option value="1-2">1-2 Guests</option>
            <option value="3-4">3-4 Guests</option>
            <option value="5+">5+ Large Groups</option>
          </select>

          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-muted)' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search guest or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '7px 12px 7px 30px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '12px',
                color: 'var(--text-primary)',
                width: '180px',
                outline: 'none'
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
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Waitlist Table (Full CRUD Display) ── */}
      <div className="full-data-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Wait #</th>
              <th>Customer / Party</th>
              <th>Party Size</th>
              <th>Est. Wait</th>
              <th>Wait Elapsed</th>
              <th>Joined At</th>
              <th>Status</th>
              <th style={{ textAlign: 'right', paddingRight: '20px' }}>Host Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Loading real-time queue...
                </td>
              </tr>
            ) : filteredQueue.length > 0 ? (
              filteredQueue.map((q) => {
                const isWaiting = q.status === 'waiting';
                const isNotified = q.status === 'notified';
                const canAssign = isWaiting || isNotified;
                const customerName = q.users?.full_name || 'Walk-In Guest';
                const customerPhone = q.users?.phone_number || '';
                const waitLabel = queueIndexMap.get(q.id) || `#W-01`;

                // Calculate elapsed waiting minutes
                const joinedMs = q.joined_at ? new Date(q.joined_at).getTime() : now;
                const elapsedMins = Math.max(0, Math.floor((now - joinedMs) / 60000));
                const estWaitMins = q.estimated_wait_time_mins || 15;
                const isOverdue = isWaiting && elapsedMins > estWaitMins;

                return (
                  <tr key={q.id}>
                    {/* Wait Number Badge */}
                    <td>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '800',
                        color: isNotified ? '#2563eb' : isWaiting ? 'var(--primary)' : '#64748b',
                        background: isNotified ? 'rgba(37, 99, 235, 0.1)' : isWaiting ? 'rgba(184, 127, 92, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        display: 'inline-block',
                        letterSpacing: '0.5px'
                      }}>
                        {waitLabel}
                      </div>
                    </td>

                    {/* Customer & Party Info */}
                    <td>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
                        {customerName}
                      </div>
                      {customerPhone ? (
                        <a
                          href={`tel:${customerPhone}`}
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '2px',
                            textDecoration: 'none'
                          }}
                        >
                          📞 {customerPhone}
                        </a>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ticket #{q.id.slice(0, 6)}</span>
                      )}
                    </td>

                    {/* Party Size */}
                    <td>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        fontSize: '13px'
                      }}>
                        👥 {q.pax} Guests
                      </div>
                    </td>

                    {/* Target Est. Wait */}
                    <td>
                      <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600' }}>
                        {estWaitMins} mins
                      </div>
                    </td>

                    {/* Elapsed Time & Overdue Indicator */}
                    <td>
                      {isWaiting ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: isOverdue ? '#dc2626' : 'var(--text-secondary)' }}>
                            {elapsedMins}m waiting
                          </span>
                          {isOverdue && (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '700',
                              color: '#dc2626',
                              background: '#fee2e2',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              +{elapsedMins - estWaitMins}m
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {q.status === 'seated' ? 'Seated' : '—'}
                        </span>
                      )}
                    </td>

                    {/* Joined At */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {fmtTime(q.joined_at)}
                    </td>

                    {/* Status Badge */}
                    <td>
                      {q.status === 'seated' && (
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: '#ecfdf5', color: '#059669' }}>
                          SEATED
                        </span>
                      )}
                      {q.status === 'notified' && (
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: '#eff6ff', color: '#2563eb' }}>
                          NOTIFIED
                        </span>
                      )}
                      {q.status === 'waiting' && (
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: '#fef3c7', color: '#d97706' }}>
                          WAITING
                        </span>
                      )}
                      {q.status === 'cancelled' && (
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: '#f1f5f9', color: '#64748b' }}>
                          CANCELLED
                        </span>
                      )}
                      {q.status === 'no_show' && (
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: '#fee2e2', color: '#b91c1c' }}>
                          NO SHOW
                        </span>
                      )}
                    </td>

                    {/* Host Actions (Seat, Notify, Edit, Delete) */}
                    <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* 1. Assign Table & Seat */}
                        {canAssign && (
                          <button
                            onClick={() => openAssignModal(q)}
                            title="Seat party at table"
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '700',
                              borderRadius: '7px',
                              border: 'none',
                              background: '#059669',
                              color: '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                            }}
                          >
                            🪑 Seat
                          </button>
                        )}

                        {/* 2. Notify Guest */}
                        {isWaiting && (
                          <button
                            onClick={() => handleNotifyGuest(q)}
                            title="Call guest via SMS / Push"
                            style={{
                              padding: '6px 10px',
                              fontSize: '12px',
                              fontWeight: '600',
                              borderRadius: '7px',
                              border: '1px solid #3b82f6',
                              background: 'rgba(59, 130, 246, 0.08)',
                              color: '#2563eb',
                              cursor: 'pointer'
                            }}
                          >
                            🔔 Call
                          </button>
                        )}

                        {/* 3. Quick Status Dropdown */}
                        <select
                          className="status-dropdown"
                          value={q.status}
                          onChange={(e) => updateStatus(q.id, e.target.value)}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="waiting">Waiting</option>
                          <option value="notified">Notified</option>
                          <option value="seated">Seated</option>
                          <option value="no_show">No Show</option>
                          <option value="cancelled">Cancelled</option>
                        </select>

                        {/* 4. Edit Party (CRUD Update) */}
                        <button
                          onClick={() => openEditModal(q)}
                          title="Edit party size, name, or phone"
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: '#ffffff',
                            color: 'var(--text-secondary)',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️
                        </button>

                        {/* 5. Delete Entry (CRUD Delete) */}
                        <button
                          onClick={() => openDeleteModal(q)}
                          title="Remove from waitlist"
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fee2e2',
                            background: '#fff1f2',
                            color: '#e11d48',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  No queue records matching the selected criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─────────────────────────────────────────────── */}
      {/* ── MODAL 1: ADD WALK-IN PARTY (CREATE) ── */}
      {/* ─────────────────────────────────────────────── */}
      {walkInModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(184, 127, 92, 0.12)',
                  padding: '9px',
                  borderRadius: '10px',
                  color: 'var(--primary)',
                  fontSize: '20px'
                }}>
                  👥
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Add Walk-In Guest
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Register a walk-in party into the live waitlist
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWalkInModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddWalkIn}>
              {/* Guest Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Guest / Party Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kasun Silva"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Phone Number with 10-digit validation */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Contact Phone (10 Digits for SMS Ready Alert):
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0771234567"
                  maxLength={10}
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                  {guestPhone.length}/10 digits entered
                </span>
              </div>

              {/* Party Size Quick Selector */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Party Size (Guests):
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {[1, 2, 4, 6, 8, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPax(n)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: parseInt(pax) === n ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: parseInt(pax) === n ? 'rgba(184, 127, 92, 0.1)' : '#ffffff',
                        color: parseInt(pax) === n ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {n} Pax
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={pax}
                  onChange={(e) => setPax(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Estimated Wait Time with Quick Adjusters */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Estimated Wait Time:
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={estWait}
                    onChange={(e) => setEstWait(e.target.value)}
                    required
                    style={{
                      width: '90px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '14px',
                      fontWeight: '700',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>minutes</span>
                  <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                    {[10, 15, 25, 40].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setEstWait(mins)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: '#f8fafc',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seating Preferences & Tags */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Seating Preferences & Special Tags:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: '👑 VIP Party', active: isVip, toggle: () => setIsVip(!isVip) },
                    { label: '👶 High Chair', active: needsHighChair, toggle: () => setNeedsHighChair(!needsHighChair) }
                  ].map(tag => (
                    <button
                      key={tag.label}
                      type="button"
                      onClick={tag.toggle}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: tag.active ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: tag.active ? 'rgba(184, 127, 92, 0.12)' : '#ffffff',
                        color: tag.active ? 'var(--primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setWalkInModalOpen(false)}
                  disabled={isSubmittingWalkIn}
                  style={{
                    padding: '10px 16px',
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
                  type="submit"
                  disabled={isSubmittingWalkIn}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingWalkIn ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 6px rgba(184, 127, 92, 0.25)'
                  }}
                >
                  {isSubmittingWalkIn ? 'Adding...' : '➕ Add to Waitlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* ── MODAL 2: EDIT PARTY DETAILS (UPDATE) ── */}
      {/* ─────────────────────────────────────────────── */}
      {editModalOpen && editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '9px',
                  borderRadius: '10px',
                  color: '#2563eb',
                  fontSize: '20px'
                }}>
                  ✏️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Edit Waitlist Party
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Update party count, phone, or wait estimates
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmEdit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Guest Name:
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Phone Number:
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Party Size (Guests):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={editPax}
                    onChange={(e) => setEditPax(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Est. Wait (Mins):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={editEstWait}
                    onChange={(e) => setEditEstWait(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Queue Status:
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                >
                  <option value="waiting">Waiting</option>
                  <option value="notified">Notified</option>
                  <option value="seated">Seated</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  disabled={isSubmittingEdit}
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
                  type="submit"
                  disabled={isSubmittingEdit}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingEdit ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingEdit ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* ── MODAL 3: DELETE / PURGE CONFIRMATION (DELETE) ── */}
      {/* ─────────────────────────────────────────────── */}
      {deleteModalOpen && deletingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                background: '#fee2e2',
                color: '#dc2626',
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Remove from Waitlist?
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {deletingItem.users?.full_name || 'Walk-In'} ({deletingItem.pax} Guests)
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '14px 0 20px 0' }}>
              You can choose to permanently purge this entry from the database, or mark it as Cancelled/No-Show to keep records intact.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmittingDelete}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isSubmittingDelete ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                🗑️ Permanently Delete Record
              </button>

              <button
                type="button"
                onClick={handleMarkAsCancelled}
                disabled={isSubmittingDelete}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: '#f8fafc',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isSubmittingDelete ? 'not-allowed' : 'pointer'
                }}
              >
                Mark as Cancelled / No-Show
              </button>

              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isSubmittingDelete}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* ── MODAL 4: DIRECT TABLE ASSIGNMENT & SEATING ── */}
      {/* ─────────────────────────────────────────────── */}
      {assignModalOpen && selectedQueueItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '9px',
                  borderRadius: '10px',
                  color: '#059669',
                  fontSize: '20px'
                }}>
                  🪑
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Assign Table & Seat Guest
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Party of {selectedQueueItem.pax} Guests • {selectedQueueItem.users?.full_name || 'Walk-In Guest'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Select Available Dining Table:
              </label>

              {availableTables.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '10px',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  padding: '2px'
                }}>
                  {availableTables.map(t => {
                    const isSelected = String(t.id) === String(selectedTableId);
                    const cap = t.capacity || 4;
                    const fits = cap >= selectedQueueItem.pax;
                    const isOptimal = fits && (cap - selectedQueueItem.pax <= 2);

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTableId(String(t.id))}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #059669' : '1px solid var(--border)',
                          background: isSelected ? '#ecfdf5' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontSize: '15px', fontWeight: '800', color: isSelected ? '#059669' : 'var(--text-primary)' }}>
                          Table {t.table_number}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: isOptimal ? '#059669' : fits ? '#0284c7' : '#b45309',
                          fontWeight: '700',
                          marginTop: '3px'
                        }}>
                          {cap} Seats {isOptimal ? '★ Best Fit' : fits ? '✓ Fits' : '(Tight)'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', background: '#fffbeb', borderRadius: '10px', color: '#b45309', fontSize: '13px' }}>
                  ⚠️ No tables currently marked as &quot;Available&quot;. Please clear or bus a table on the Floor Plan first.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                disabled={isSubmittingAssign}
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
                onClick={handleConfirmAssignTable}
                disabled={isSubmittingAssign || !selectedTableId}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: (isSubmittingAssign || !selectedTableId) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 6px rgba(5, 150, 105, 0.25)'
                }}
              >
                {isSubmittingAssign ? 'Seating...' : '✓ Seat Guest Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
