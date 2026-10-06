"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Trash2,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  CalendarX,
  CalendarCheck,
  Info,
  X,
  Send,
  Save,
  Coffee,
  Store
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function formatDisplayTime(timeStr) {
  if (!timeStr) return '--:--';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return dateStr;
  }
}

export default function OperatingHoursPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Operating Hours State
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('23:00');
  const [cutoffMinutes, setCutoffMinutes] = useState(60);
  const [savingHours, setSavingHours] = useState(false);
  const [notifyHoursChange, setNotifyHoursChange] = useState(false);
  const [customHoursNotice, setCustomHoursNotice] = useState('');

  // Status State
  const [isOpenToday, setIsOpenToday] = useState(true);
  const [closureToday, setClosureToday] = useState(null);
  const [todayDate, setTodayDate] = useState('');

  // Closures List State
  const [closures, setClosures] = useState([]);
  const [loadingClosures, setLoadingClosures] = useState(false);

  // Emergency Close Modal State
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('Kitchen Emergency & Maintenance');
  const [emergencyNotify, setEmergencyNotify] = useState(true);
  const [emergencyCustomNotice, setEmergencyCustomNotice] = useState('');
  const [submittingEmergency, setSubmittingEmergency] = useState(false);

  // New Holiday/Closure State
  const [newClosureDate, setNewClosureDate] = useState('');
  const [newClosureReason, setNewClosureReason] = useState('');
  const [newClosureNotify, setNewClosureNotify] = useState(true);
  const [newClosureCustomNotice, setNewClosureCustomNotice] = useState('');
  const [schedulingClosure, setSchedulingClosure] = useState(false);

  // Conflict Modal State (if bookings exist on scheduled date)
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState(null);

  // Delete Closure Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [closureToDelete, setClosureToDelete] = useState(null);
  const [deletingClosure, setDeletingClosure] = useState(false);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Load operating hours & today's status
  async function loadData(isManual = false) {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/operating-hours`);
      if (res.ok) {
        const data = await res.json();
        setTodayDate(data.today_date || '');
        setIsOpenToday(data.is_open_today);
        setClosureToday(data.closure_today);

        if (data.default_open_time) setOpenTime(data.default_open_time.slice(0, 5));
        if (data.default_close_time) setCloseTime(data.default_close_time.slice(0, 5));
        if (data.last_booking_minutes_before_close) setCutoffMinutes(data.last_booking_minutes_before_close);
      }

      await loadClosures();
    } catch (err) {
      console.error('Error fetching operating hours:', err);
      showToast('Failed to load operating hours data', 'error');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }

  // Load closures list
  async function loadClosures() {
    setLoadingClosures(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/closures`);
      if (res.ok) {
        const data = await res.json();
        setClosures(data.closures || []);
      }
    } catch (err) {
      console.error('Error fetching closures:', err);
    } finally {
      setLoadingClosures(false);
    }
  }

  useEffect(() => {
    loadData();

    // Subscribe to realtime updates on both tables
    const channelId = Math.random().toString(36).substring(2, 9);
    const hoursSub = supabase
      .channel(`hours_realtime_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_operating_hours' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_special_closures' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(hoursSub);
    };
  }, []);

  // Helper to send instant realtime broadcast to mobile app
  async function broadcastHoursChange(eventType = 'hours_updated') {
    try {
      const channel = supabase.channel('restaurant_operating_hours_sync');
      await channel.send({
        type: 'broadcast',
        event: eventType,
        payload: { timestamp: Date.now() }
      });
    } catch (e) {
      console.warn('Realtime broadcast error from admin:', e);
    }
  }

  // Save standard hours
  async function handleSaveHours(e) {
    e.preventDefault();
    setSavingHours(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/operating-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_open_time: `${openTime}:00`,
          default_close_time: `${closeTime}:00`,
          last_booking_minutes_before_close: Number(cutoffMinutes),
          send_notification: notifyHoursChange,
          notification_message: notifyHoursChange && customHoursNotice ? customHoursNotice : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update hours');

      showToast('Standard operating hours updated successfully!');
      setNotifyHoursChange(false);
      setCustomHoursNotice('');
      await broadcastHoursChange('hours_updated');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingHours(false);
    }
  }

  // Handle emergency close today
  async function handleEmergencyCloseToday() {
    if (!emergencyReason.trim()) {
      showToast('Please provide a reason for closing today', 'error');
      return;
    }

    setSubmittingEmergency(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/closures/emergency-close-today`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: emergencyReason.trim(),
          send_notification: emergencyNotify,
          notification_message: emergencyCustomNotice.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark restaurant closed today');

      const notice = data.affected_reservations > 0
        ? `Restaurant closed for today. ${data.affected_reservations} affected reservations were auto-cancelled.`
        : 'Restaurant marked as closed for today.';
      showToast(notice);
      setEmergencyModalOpen(false);
      setEmergencyReason('Kitchen Emergency & Maintenance');
      setEmergencyCustomNotice('');
      await broadcastHoursChange('closure_updated');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingEmergency(false);
    }
  }

  // Handle reopening today (revert emergency close)
  async function handleReopenToday() {
    if (!closureToday) return;
    if (!confirm('Are you sure you want to reopen TableFlow for today? Guests will be able to make reservations and join the queue.')) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/closures/${closureToday.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to reopen restaurant');

      showToast('TableFlow reopened for today!');
      await broadcastHoursChange('closure_updated');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Schedule a holiday / closure date
  async function handleScheduleClosure(autoCancel = false) {
    if (!newClosureDate) {
      showToast('Please select a closure date', 'error');
      return;
    }
    if (!newClosureReason.trim()) {
      showToast('Please enter a reason for the closure', 'error');
      return;
    }

    setSchedulingClosure(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/closures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          close_date: newClosureDate,
          reason: newClosureReason.trim(),
          is_full_day: true,
          auto_cancel_conflicts: autoCancel,
          send_notification: newClosureNotify,
          notification_message: newClosureCustomNotice.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule closure');

      if (data.has_conflicts && !autoCancel) {
        setConflictData(data);
        setConflictModalOpen(true);
        return;
      }

      showToast(
        data.cancelled_reservations > 0
          ? `Holiday scheduled! ${data.cancelled_reservations} conflicting reservations were auto-cancelled.`
          : 'Holiday / Closure date scheduled successfully!'
      );

      setConflictModalOpen(false);
      setConflictData(null);
      setNewClosureDate('');
      setNewClosureReason('');
      setNewClosureCustomNotice('');
      await broadcastHoursChange('closure_updated');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSchedulingClosure(false);
    }
  }

  // Delete a scheduled closure date
  async function handleDeleteClosure() {
    if (!closureToDelete) return;
    setDeletingClosure(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/closures/${closureToDelete.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove closure date');

      showToast('Closure date removed successfully');
      setDeleteModalOpen(false);
      setClosureToDelete(null);
      await broadcastHoursChange('closure_updated');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeletingClosure(false);
    }
  }

  // Calculate last reservation time display
  const lastBookingTimeFormatted = (() => {
    try {
      const [h, m] = closeTime.split(':').map(Number);
      const closeMinutesTotal = h * 60 + m;
      const lastBookingMinutes = closeMinutesTotal - Number(cutoffMinutes || 60);
      if (lastBookingMinutes < 0) return '--:--';
      const lastH = Math.floor(lastBookingMinutes / 60);
      const lastM = lastBookingMinutes % 60;
      return formatDisplayTime(`${lastH.toString().padStart(2, '0')}:${lastM.toString().padStart(2, '0')}:00`);
    } catch (_) {
      return '--:--';
    }
  })();

  return (
    <div className="admin-content" style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          padding: '14px 22px',
          borderRadius: '10px',
          fontSize: '0.9rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          animation: 'fadeIn 0.25s ease'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', color: 'var(--text-primary)', fontWeight: 700 }}>
              Operating Hours &amp; Closures
            </h1>
            <span style={{
              background: 'rgba(184, 127, 92, 0.1)',
              color: 'var(--primary)',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.5px'
            }}>
              Colombo Time (UTC+05:30)
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '6px' }}>
            Configure regular restaurant opening times, schedule holidays, and manage emergency closures with real-time push notices.
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <RefreshCw size={16} className={refreshing ? 'spin-icon' : ''} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Hero: Current Status Banner */}
      <div style={{
        background: isOpenToday
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(248, 250, 252, 1) 100%)'
          : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(248, 250, 252, 1) 100%)',
        border: `1px solid ${isOpenToday ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
        borderRadius: '14px',
        padding: '24px 28px',
        marginBottom: '32px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isOpenToday ? '#10b981' : '#ef4444',
            color: '#ffffff',
            boxShadow: `0 4px 14px ${isOpenToday ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
          }}>
            {isOpenToday ? <Store size={28} /> : <CalendarX size={28} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isOpenToday ? 'Restaurant Is Open Today' : 'Restaurant Is CLOSED Today'}
              </h2>
              <span style={{
                background: isOpenToday ? '#d1fae5' : '#fee2e2',
                color: isOpenToday ? '#065f46' : '#991b1b',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {isOpenToday ? 'Active & Receiving Guests' : 'Queue & Bookings Disabled'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
              {isOpenToday ? (
                <>Operating today: <strong>{formatDisplayTime(openTime)} – {formatDisplayTime(closeTime)}</strong> • Last booking accepted until <strong>{lastBookingTimeFormatted}</strong> ({cutoffMinutes}m cutoff)</>
              ) : (
                <>Reason: <strong>{closureToday?.reason || 'Closed'}</strong> • Resets automatically tomorrow morning at 00:00 Colombo time.</>
              )}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isOpenToday ? (
            <button
              onClick={() => setEmergencyModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 20px',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
              onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
            >
              <AlertTriangle size={18} />
              <span>Close for Today (Emergency)</span>
            </button>
          ) : (
            <button
              onClick={handleReopenToday}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 20px',
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#059669'}
              onMouseOut={e => e.currentTarget.style.background = '#10b981'}
            >
              <CheckCircle2 size={18} />
              <span>Reopen Restaurant for Today</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Left = Standard Hours Settings, Right = Schedule Holiday / Closure */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '28px', marginBottom: '36px' }}>
        
        {/* 1. Standard Weekly Operating Hours Form */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '28px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(184, 127, 92, 0.1)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Clock size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Regular Operating Hours
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                Standard opening, closing, and reservation acceptance cutoff.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveHours} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Opening Time
                </label>
                <input
                  type="time"
                  value={openTime}
                  onChange={e => setOpenTime(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.95rem',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-surface)'
                  }}
                />
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Formatted: {formatDisplayTime(openTime)}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Closing Time
                </label>
                <input
                  type="time"
                  value={closeTime}
                  onChange={e => setCloseTime(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.95rem',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-surface)'
                  }}
                />
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Formatted: {formatDisplayTime(closeTime)}
                </span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Last Booking Cutoff (Minutes before close)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="number"
                  min="0"
                  max="240"
                  step="15"
                  value={cutoffMinutes}
                  onChange={e => setCutoffMinutes(e.target.value)}
                  style={{
                    width: '120px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.95rem',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-surface)'
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  minutes (Last accepted booking: <strong>{lastBookingTimeFormatted}</strong>)
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Prevents guests from booking reservations within {cutoffMinutes} minutes of restaurant closing.
              </p>
            </div>

            {/* Notification Checkbox */}
            <div style={{
              background: 'var(--bg-surface)',
              padding: '14px 16px',
              borderRadius: '10px',
              border: '1px solid var(--border)'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={notifyHoursChange}
                  onChange={e => setNotifyHoursChange(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bell size={16} color="var(--primary)" />
                  Broadcast push notification to customers about hours change
                </span>
              </label>

              {notifyHoursChange && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Custom Announcement Message (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={customHoursNotice}
                    onChange={e => setCustomHoursNotice(e.target.value)}
                    placeholder={`Our dining hours are now updated: ${formatDisplayTime(openTime)} to ${formatDisplayTime(closeTime)}.`}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={savingHours}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.92rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(184, 127, 92, 0.25)',
                transition: 'all 0.2s ease',
                marginTop: '4px'
              }}
            >
              <Save size={18} />
              <span>{savingHours ? 'Saving Changes...' : 'Save Standard Hours'}</span>
            </button>
          </form>
        </div>

        {/* 2. Schedule Advance Holiday / Closure */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '28px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(212, 175, 55, 0.12)',
              color: 'var(--gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CalendarCheck size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Schedule Holiday or Closure
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                Block specific dates for public holidays, festivals, or scheduled renovations.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Closure Date
              </label>
              <input
                type="date"
                min={todayDate || new Date().toISOString().split('T')[0]}
                value={newClosureDate}
                onChange={e => setNewClosureDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-surface)'
                }}
              />
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Selected: {newClosureDate ? formatDisplayDate(newClosureDate) : 'None'}
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Reason / Occasion
              </label>
              <input
                type="text"
                placeholder="e.g. Sinhala & Tamil New Year Holiday, Christmas, Annual Renovation"
                value={newClosureReason}
                onChange={e => setNewClosureReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-surface)'
                }}
              />
            </div>

            {/* Notification Checkbox */}
            <div style={{
              background: 'var(--bg-surface)',
              padding: '14px 16px',
              borderRadius: '10px',
              border: '1px solid var(--border)'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={newClosureNotify}
                  onChange={e => setNewClosureNotify(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bell size={16} color="var(--primary)" />
                  Send advance notification to all customers
                </span>
              </label>

              {newClosureNotify && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Custom Announcement Message (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={newClosureCustomNotice}
                    onChange={e => setNewClosureCustomNotice(e.target.value)}
                    placeholder={newClosureDate ? `TableFlow will be closed on ${newClosureDate} for ${newClosureReason || 'holiday'}. Advance bookings for other dates remain open!` : 'TableFlow will be closed on this date...'}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleScheduleClosure(false)}
              disabled={schedulingClosure}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.92rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
                transition: 'all 0.2s ease',
                marginTop: '4px'
              }}
            >
              <CalendarCheck size={18} />
              <span>{schedulingClosure ? 'Scheduling...' : 'Add Closure Date'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* 3. Closures / Holidays Table */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Scheduled Closures &amp; Holidays
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              Dates where TableFlow is closed or operating on special schedules.
            </p>
          </div>

          <span style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            fontWeight: 600
          }}>
            Total {closures.length} closure date(s)
          </span>
        </div>

        {loadingClosures ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading closures schedule...
          </div>
        ) : closures.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <CalendarCheck size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600 }}>No Closures Scheduled</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', maxWidth: '420px', margin: '6px auto 0' }}>
              The restaurant is operating on normal weekly hours ({formatDisplayTime(openTime)} – {formatDisplayTime(closeTime)}) with no planned holiday shutdowns.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 24px', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600 }}>Status / Type</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600 }}>Reason / Details</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600 }}>Customers Notified</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {closures.map(item => {
                  const isTodayItem = item.close_date === todayDate;
                  const isPast = item.close_date < todayDate;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isTodayItem ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                        opacity: isPast ? 0.6 : 1
                      }}
                    >
                      <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Calendar size={16} color="var(--primary)" />
                          <span>{formatDisplayDate(item.close_date)}</span>
                          {isTodayItem && (
                            <span style={{
                              background: '#fee2e2',
                              color: '#b91c1c',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '10px'
                            }}>
                              TODAY
                            </span>
                          )}
                          {isPast && (
                            <span style={{
                              background: '#f1f5f9',
                              color: '#64748b',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '10px'
                            }}>
                              PAST
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '16px 24px' }}>
                        {item.created_by_emergency ? (
                          <span style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.76rem',
                            fontWeight: 700
                          }}>
                            🚨 Emergency Closure
                          </span>
                        ) : (
                          <span style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.76rem',
                            fontWeight: 700
                          }}>
                            📅 Scheduled Holiday
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '16px 24px', color: 'var(--text-primary)' }}>
                        {item.reason}
                      </td>

                      <td style={{ padding: '16px 24px' }}>
                        {item.notified_customers ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.82rem', fontWeight: 600 }}>
                            <CheckCircle2 size={15} /> Push Sent
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            No broadcast
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setClosureToDelete(item);
                            setDeleteModalOpen(true);
                          }}
                          title="Remove closure / Reopen date"
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '7px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={e => {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.borderColor = '#fca5a5';
                          }}
                          onMouseOut={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'var(--border)';
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Emergency Close Today */}
      {emergencyModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Close Restaurant for Today
                </h3>
              </div>
              <button
                onClick={() => setEmergencyModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '18px', lineHeight: 1.5 }}>
              Closing today will disable queue join and table reservations for today. <strong>Any pending or confirmed reservations today will be automatically cancelled with a notification.</strong>
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Reason for Closure
              </label>
              <input
                type="text"
                value={emergencyReason}
                onChange={e => setEmergencyReason(e.target.value)}
                placeholder="e.g. Kitchen Maintenance, Bad Weather, Staff Emergency"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.92rem',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              marginBottom: '20px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={emergencyNotify}
                  onChange={e => setEmergencyNotify(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#ef4444' }}
                />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Send emergency push notification to customers
                </span>
              </label>

              {emergencyNotify && (
                <div style={{ marginTop: '10px' }}>
                  <textarea
                    rows={2}
                    value={emergencyCustomNotice}
                    onChange={e => setEmergencyCustomNotice(e.target.value)}
                    placeholder={`TableFlow is closed today (${emergencyReason}). Normal hours will resume tomorrow.`}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      fontSize: '0.82rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setEmergencyModalOpen(false)}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleEmergencyCloseToday}
                disabled={submittingEmergency}
                style={{
                  padding: '10px 20px',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
                }}
              >
                {submittingEmergency ? 'Processing...' : 'Confirm Emergency Closure'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reservation Conflicts Warning */}
      {conflictModalOpen && conflictData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Existing Bookings Found!
                </h3>
              </div>
              <button
                onClick={() => setConflictModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
              There are <strong>{conflictData.conflicting_count} reservation(s)</strong> already booked for <strong>{formatDisplayDate(newClosureDate)}</strong>.
            </p>

            <div style={{
              maxHeight: '180px',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              borderRadius: '8px',
              padding: '12px 16px',
              border: '1px solid var(--border)',
              marginBottom: '20px'
            }}>
              {conflictData.conflicts?.map((resv, idx) => (
                <div key={resv.id || idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: idx === conflictData.conflicts.length - 1 ? 'none' : '1px solid var(--border)',
                  fontSize: '0.85rem'
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {resv.users?.full_name || 'Guest'} ({resv.pax} Guests)
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Time: {formatDisplayTime(resv.reservation_time)}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '0.82rem', color: '#b91c1c', marginBottom: '20px' }}>
              If you proceed, all conflicting reservations on this date will be automatically marked as <strong>cancelled</strong> with notification reply to customers.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setConflictModalOpen(false)}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                Go Back
              </button>

              <button
                type="button"
                onClick={() => handleScheduleClosure(true)}
                disabled={schedulingClosure}
                style={{
                  padding: '10px 20px',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
                }}
              >
                {schedulingClosure ? 'Auto-Cancelling...' : 'Auto-Cancel Bookings & Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete / Reopen Confirmation */}
      {deleteModalOpen && closureToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            maxWidth: '460px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid var(--border)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
              Remove Closure Date?
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '22px' }}>
              Are you sure you want to remove the closure for <strong>{formatDisplayDate(closureToDelete.close_date)}</strong> ({closureToDelete.reason})? TableFlow will operate normally on this day.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setClosureToDelete(null);
                }}
                style={{
                  padding: '9px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                Keep Closure
              </button>

              <button
                type="button"
                onClick={handleDeleteClosure}
                disabled={deletingClosure}
                style={{
                  padding: '9px 18px',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {deletingClosure ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
