"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const API_BASE = 'http://localhost:3000';

function badge(type, text) {
  return <span className={`badge badge-${type}`}>{text}</span>;
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
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState(null);

  // Walk-In Modal State
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [pax, setPax] = useState(2);
  const [estWait, setEstWait] = useState(15);
  const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false);

  // Assign Table Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  async function fetchQueueAndTables() {
    try {
      const [queueRes, tablesRes] = await Promise.all([
        supabase
          .from('queue_entries')
          .select('*, users(full_name, phone_number)')
          .order('queue_number', { ascending: true, nullsFirst: false })
          .order('joined_at', { ascending: true }),
        supabase
          .from('restaurant_tables')
          .select('*')
          .order('table_number', { ascending: true })
      ]);

      if (queueRes.data) setData(queueRes.data);
      if (tablesRes.data) setTables(tablesRes.data);
    } catch (e) {
      console.error('Error fetching queue or tables:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [queueRes, tablesRes] = await Promise.all([
          supabase
            .from('queue_entries')
            .select('*, users(full_name, phone_number)')
            .order('queue_number', { ascending: true, nullsFirst: false })
            .order('joined_at', { ascending: true }),
          supabase
            .from('restaurant_tables')
            .select('*')
            .order('table_number', { ascending: true })
        ]);

        if (!ignore) {
          if (queueRes.data) setData(queueRes.data);
          if (tablesRes.data) setTables(tablesRes.data);
          setLoading(false);
        }
      } catch (e) {
        if (!ignore) setLoading(false);
      }
    }

    load();

    const queueChannel = supabase.channel('admin_queue_realtime').on('postgres_changes',
      { event: '*', schema: 'public', table: 'queue_entries' },
      () => { fetchQueueAndTables(); }
    ).subscribe();

    const tablesChannel = supabase.channel('admin_tables_realtime').on('postgres_changes',
      { event: '*', schema: 'public', table: 'restaurant_tables' },
      () => { fetchQueueAndTables(); }
    ).subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(tablesChannel);
    };
  }, []);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

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

  // Handle Walk-In Creation
  async function handleAddWalkIn(e) {
    e.preventDefault();
    setIsSubmittingWalkIn(true);
    try {
      const res = await fetch(`${API_BASE}/api/queue/walk-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guestName.trim() || 'Walk-In Guest',
          phone_number: guestPhone.trim() || null,
          pax: parseInt(pax) || 2,
          estimated_wait_time_mins: parseInt(estWait) || 15
        })
      });

      if (res.ok) {
        showToast('✅ Walk-In guest added to waitlist successfully!');
        setWalkInModalOpen(false);
        setGuestName('');
        setGuestPhone('');
        setPax(2);
        setEstWait(15);
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
        showToast('✅ Walk-In guest added to waitlist!');
        setWalkInModalOpen(false);
        fetchQueueAndTables();
      }
    } catch (err) {
      showToast('❌ Error adding walk-in: ' + err.message);
    } finally {
      setIsSubmittingWalkIn(false);
    }
  }

  // Open Direct Table Assignment Modal
  function openAssignModal(queueItem) {
    setSelectedQueueItem(queueItem);
    // Find first available table that fits party size
    const suitableTable = tables.find(t => t.status === 'available' && (t.capacity || 4) >= queueItem.pax);
    const anyAvailable = suitableTable || tables.find(t => t.status === 'available');
    setSelectedTableId(anyAvailable ? String(anyAvailable.id) : '');
    setAssignModalOpen(true);
  }

  // Handle Direct Table Assignment
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
        showToast('✅ Table assigned and guest seated!');
      } else {
        // Fallback direct Supabase updates
        await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', selectedTableId);
        await supabase.from('queue_entries').update({
          status: 'seated',
          seated_at: new Date().toISOString()
        }).eq('id', selectedQueueItem.id);
        showToast('✅ Table assigned and guest seated!');
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

  // Statistics
  const stats = useMemo(() => {
    let waiting = 0;
    let notified = 0;
    let seated = 0;
    let totalPax = 0;

    data.forEach(q => {
      if (q.status === 'waiting') {
        waiting++;
        totalPax += q.pax || 2;
      }
      if (q.status === 'notified') notified++;
      if (q.status === 'seated') seated++;
    });

    const estAvgWait = waiting > 0 ? Math.round((waiting * 7) + 5) : 0;
    return { waiting, notified, seated, estAvgWait, totalPax };
  }, [data]);

  // Filtered queue
  const filteredQueue = useMemo(() => {
    if (statusFilter === 'ALL') return data;
    if (statusFilter === 'WAITING') return data.filter(q => q.status === 'waiting');
    if (statusFilter === 'NOTIFIED') return data.filter(q => q.status === 'notified');
    if (statusFilter === 'SEATED') return data.filter(q => q.status === 'seated');
    if (statusFilter === 'CLOSED') return data.filter(q => q.status === 'cancelled' || q.status === 'no_show');
    return data;
  }, [data, statusFilter]);

  if (loading) return <p style={{ color: 'var(--text-muted)', padding: '24px' }}>Loading Live Queue...</p>;

  const availableTables = tables.filter(t => t.status === 'available');

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: '#1e293b',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          fontSize: '13px',
          fontWeight: '600'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Top Header & Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            Live Queue & Host Desk
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Manage walk-in guest registration, waitlist notifications, and direct table assignment.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setWalkInModalOpen(true)}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--primary)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(184, 127, 92, 0.3)'
            }}
          >
            ➕ Add Walk-In Party
          </button>
          <button
            onClick={fetchQueueAndTables}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: '#ffffff',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Real-time Summary Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: '14px', border: '1px solid #fef3c7' }}>
          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '700', textTransform: 'uppercase' }}>⏳ WAITING IN QUEUE</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>{stats.waiting}</div>
          <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>{stats.totalPax} total waiting guests</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: '14px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: '700', textTransform: 'uppercase' }}>🔔 NOTIFIED & READY</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>{stats.notified}</div>
          <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '2px' }}>Called to host counter</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '11px', color: '#15803d', fontWeight: '700', textTransform: 'uppercase' }}>🪑 SEATED TODAY</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>{stats.seated}</div>
          <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>Parties served</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>⏱️ EST. WAIT TIME</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
            {stats.estAvgWait > 0 ? `${stats.estAvgWait}m` : 'No wait'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {availableTables.length} tables currently free
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'ALL', label: `All (${data.length})` },
          { id: 'WAITING', label: `Waiting (${stats.waiting})` },
          { id: 'NOTIFIED', label: `Notified (${stats.notified})` },
          { id: 'SEATED', label: `Seated (${stats.seated})` },
          { id: 'CLOSED', label: `Cancelled / No Show` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            style={{
              padding: '7px 16px',
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

      {/* Queue Table */}
      <div className="full-data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Wait #</th>
              <th>Customer / Party</th>
              <th>Party Size</th>
              <th>Est. Wait</th>
              <th>Joined At</th>
              <th>Status</th>
              <th>Host Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredQueue.length > 0 ? filteredQueue.map((q) => {
              const isWaiting = q.status === 'waiting';
              const isNotified = q.status === 'notified';
              const canAssign = isWaiting || isNotified;
              const customerName = q.users?.full_name || 'Walk-In Guest';
              const customerPhone = q.users?.phone_number || '';

              return (
                <tr key={q.id}>
                  {/* Wait Number */}
                  <td>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      color: 'var(--primary)',
                      background: 'rgba(184, 127, 92, 0.1)',
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      #{q.queue_number || '?'}
                    </div>
                  </td>

                  {/* Customer / Party Info */}
                  <td>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
                      {customerName}
                    </div>
                    {customerPhone ? (
                      <a href={`tel:${customerPhone}`} style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                        📞 {customerPhone}
                      </a>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ticket #{q.id.slice(0, 6)}</span>
                    )}
                  </td>

                  {/* Party Size */}
                  <td>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px' }}>
                      👥 {q.pax} Guests
                    </div>
                  </td>

                  {/* Est. Wait */}
                  <td>
                    <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600' }}>
                      {q.estimated_wait_time_mins ? `${q.estimated_wait_time_mins} mins` : '15 mins'}
                    </div>
                  </td>

                  {/* Joined At */}
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {fmtTime(q.joined_at)}
                  </td>

                  {/* Status Badge */}
                  <td>
                    {badge(
                      q.status === 'seated' ? 'success' : q.status === 'notified' ? 'info' : q.status === 'waiting' ? 'warning' : 'muted',
                      q.status.toUpperCase()
                    )}
                  </td>

                  {/* Actions */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Direct Table Assignment Button */}
                      {canAssign && (
                        <button
                          onClick={() => openAssignModal(q)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            borderRadius: '6px',
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
                          🪑 Assign Table & Seat
                        </button>
                      )}

                      {/* Notify Button */}
                      {isWaiting && (
                        <button
                          onClick={() => updateStatus(q.id, 'notified')}
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: '600',
                            borderRadius: '6px',
                            border: '1px solid #3b82f6',
                            background: 'rgba(59, 130, 246, 0.08)',
                            color: '#2563eb',
                            cursor: 'pointer'
                          }}
                        >
                          🔔 Notify
                        </button>
                      )}

                      {/* Status Dropdown */}
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
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px' }}>
                  No queue entries matching your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Add Walk-In Party ── */}
      {walkInModalOpen && (
        <div style={{
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
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '460px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(184, 127, 92, 0.1)',
                  padding: '8px',
                  borderRadius: '10px',
                  color: 'var(--primary)',
                  fontSize: '18px'
                }}>
                  👥
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Add Walk-In Guest
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Issue a queue waitlist token from the host desk
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
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Guest Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kasun Silva"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
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
                  Mobile Phone Number (Optional, for SMS/Call):
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 077 123 4567"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Party Size (Guests):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={pax}
                    onChange={(e) => setPax(e.target.value)}
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
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Est. Wait (Mins):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={estWait}
                    onChange={(e) => setEstWait(e.target.value)}
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
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setWalkInModalOpen(false)}
                  disabled={isSubmittingWalkIn}
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
                  disabled={isSubmittingWalkIn}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingWalkIn ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingWalkIn ? 'Adding...' : '➕ Add to Waitlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Direct Table Assignment ── */}
      {assignModalOpen && selectedQueueItem && (
        <div style={{
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
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '500px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '8px',
                  borderRadius: '10px',
                  color: '#059669',
                  fontSize: '20px'
                }}>
                  🪑
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Assign Table & Seat Guest
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Wait #{selectedQueueItem.queue_number} • {selectedQueueItem.pax} Guests ({selectedQueueItem.users?.full_name || 'Walk-In'})
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
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '10px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  padding: '2px'
                }}>
                  {availableTables.map(t => {
                    const isSelected = String(t.id) === String(selectedTableId);
                    const fits = (t.capacity || 4) >= selectedQueueItem.pax;

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
                        <div style={{ fontSize: '11px', color: fits ? '#059669' : '#b45309', fontWeight: '600', marginTop: '2px' }}>
                          {t.capacity || 4} Seats {fits ? '✓' : '(tight)'}
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
                  cursor: (isSubmittingAssign || !selectedTableId) ? 'not-allowed' : 'pointer'
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
