"use client";

import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Clock,
  Radio,
  Sparkles,
  Send,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  CheckSquare,
  Phone,
  MapPin,
  Trash2,
  Search,
  RotateCcw,
  Sun,
  Sunset,
  Moon,
  ShieldAlert,
  BellRing,
  Edit3,
  Download,
  Printer,
  FileText,
  X
} from 'lucide-react';
import { API_BASE } from '../../lib/api';

export default function StaffRosterAndBroadcastPage() {
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'broadcast' | 'cleaning'

  // Date & Shifts state
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [shiftFilter, setShiftFilter] = useState('all'); // 'all' | 'morning' | 'evening' | 'night'
  const [searchQuery, setSearchQuery] = useState('');

  // Add shift modal
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [shiftFormData, setShiftFormData] = useState({
    shift_type: 'morning',
    staff_name: '',
    staff_role: 'Floor Waiter',
    assigned_section: 'Main Dining Hall',
    status: 'scheduled',
    phone: '',
    notes: ''
  });
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  // Edit shift modal
  const [isEditShiftOpen, setIsEditShiftOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    shift_type: 'morning',
    staff_name: '',
    staff_role: 'Floor Waiter',
    assigned_section: 'Main Dining Hall',
    status: 'scheduled',
    phone: '',
    notes: ''
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState(null);
  const [isDeletingShift, setIsDeletingShift] = useState(false);

  // Report Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Broadcast state
  const [broadcastTarget, setBroadcastTarget] = useState('all_users');
  const [broadcastPriority, setBroadcastPriority] = useState('normal');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastActionUrl, setBroadcastActionUrl] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastLogs, setBroadcastLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Cleaning / Turnover state
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [cleaningFilter, setCleaningFilter] = useState('cleaning_only'); // 'cleaning_only' | 'all'
  const [checkedTasks, setCheckedTasks] = useState({});
  const [updatingTableId, setUpdatingTableId] = useState(null);

  // Toast banner
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast(prev => ({ msg, type, id: (prev?.id || 0) + 1 }));
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }

  // Fetch shifts
  const fetchShifts = useCallback(async (date) => {
    setShiftsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/shifts?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setShifts(data.shifts || []);
      }
    } catch (err) {
      console.error('Failed to fetch shifts:', err);
    } finally {
      setShiftsLoading(false);
    }
  }, []);

  // Fetch broadcast history
  const fetchBroadcastHistory = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/broadcast-history`);
      if (res.ok) {
        const data = await res.json();
        setBroadcastLogs(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch broadcast logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // Fetch tables for cleaning checklist
  const fetchTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tables`);
      if (res.ok) {
        const data = await res.json();
        setTables(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [shiftRes, logsRes, tblRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/shifts?date=${selectedDate}`),
          fetch(`${API_BASE}/api/admin/broadcast-history`),
          fetch(`${API_BASE}/api/tables`)
        ]);
        if (!ignore && shiftRes.ok) {
          const s = await shiftRes.json();
          setShifts(s.shifts || []);
        }
        if (!ignore && logsRes.ok) {
          const l = await logsRes.json();
          setBroadcastLogs(l.history || []);
        }
        if (!ignore && tblRes.ok) {
          const t = await tblRes.json();
          setTables(t || []);
        }
      } catch (e) {
        console.error('Initial roster data load error:', e);
      } finally {
        if (!ignore) {
          setShiftsLoading(false);
          setTablesLoading(false);
        }
      }
    }
    init();
    return () => { ignore = true; };
  }, [selectedDate]);

  // Handle shift creation
  async function handleAddShift(e) {
    e.preventDefault();
    if (!shiftFormData.staff_name.trim()) {
      showToast('Staff member name is required', 'error');
      return;
    }
    setIsSubmittingShift(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...shiftFormData,
          date: selectedDate
        })
      });
      if (res.ok) {
        showToast(`Shift assigned for ${shiftFormData.staff_name}!`);
        setIsAddShiftOpen(false);
        setShiftFormData({
          shift_type: 'morning',
          staff_name: '',
          staff_role: 'Floor Waiter',
          assigned_section: 'Main Dining Hall',
          status: 'scheduled',
          phone: '',
          notes: ''
        });
        fetchShifts(selectedDate);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to assign shift', 'error');
      }
    } catch {
      showToast('Network error assigning shift', 'error');
    } finally {
      setIsSubmittingShift(false);
    }
  }

  // Update shift status
  async function handleUpdateShiftStatus(id, newStatus) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/shifts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setShifts(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
        showToast(`Shift marked as ${newStatus.replace('_', ' ')}`);
      }
    } catch {
      showToast('Failed to update shift status', 'error');
    }
  }

  // Quick 1-click update shift type (morning / evening / night)
  async function handleUpdateShiftType(id, newShiftType) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/shifts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_type: newShiftType })
      });
      if (res.ok) {
        setShifts(prev => prev.map(s => s.id === id ? { ...s, shift_type: newShiftType } : s));
        showToast(`Shift window updated to ${newShiftType.toUpperCase()}!`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update shift type', 'error');
      }
    } catch {
      showToast('Network error updating shift type', 'error');
    }
  }

  // Open Edit Shift Modal
  function openEditShiftModal(shift) {
    setEditingShiftId(shift.id);
    setEditFormData({
      shift_type: shift.shift_type || 'morning',
      staff_name: shift.staff_name || '',
      staff_role: shift.staff_role || 'Floor Waiter',
      assigned_section: shift.assigned_section || 'Main Dining Hall',
      status: shift.status || 'scheduled',
      phone: shift.phone || '',
      notes: shift.notes || ''
    });
    setIsEditShiftOpen(true);
  }

  // Submit Edited Shift
  async function handleSaveEditedShift(e) {
    e.preventDefault();
    if (!editFormData.staff_name.trim()) {
      showToast('Staff member name is required', 'error');
      return;
    }
    setIsSubmittingEdit(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/shifts/${editingShiftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      if (res.ok) {
        setShifts(prev => prev.map(s => s.id === editingShiftId ? { ...s, ...editFormData } : s));
        showToast(`Shift updated for ${editFormData.staff_name}!`);
        setIsEditShiftOpen(false);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update shift', 'error');
      }
    } catch {
      showToast('Network error saving shift', 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  // Open Danger Delete Confirmation Modal
  function openDeleteModal(shift) {
    setShiftToDelete(shift);
    setIsDeleteModalOpen(true);
  }

  // Confirm delete shift
  async function handleConfirmDeleteShift() {
    if (!shiftToDelete) return;
    setIsDeletingShift(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/shifts/${shiftToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setShifts(prev => prev.filter(s => s.id !== shiftToDelete.id));
        showToast(`Removed shift assignment for ${shiftToDelete.staff_name}`);
        setIsDeleteModalOpen(false);
        setShiftToDelete(null);
      } else {
        showToast('Failed to remove shift', 'error');
      }
    } catch {
      showToast('Network error removing shift', 'error');
    } finally {
      setIsDeletingShift(false);
    }
  }

  // Export Roster to CSV
  function handleExportRosterCsv() {
    if (shifts.length === 0) {
      showToast('No shift roster data to export for this date', 'error');
      return;
    }

    const headers = ['Staff Name', 'Shift Window', 'Role / Position', 'Assigned Section', 'Duty Status', 'Contact Phone', 'Notes', 'Date'];
    const rows = shifts.map(s => [
      `"${(s.staff_name || '').replace(/"/g, '""')}"`,
      `"${s.shift_type || ''}"`,
      `"${(s.staff_role || '').replace(/"/g, '""')}"`,
      `"${(s.assigned_section || '').replace(/"/g, '""')}"`,
      `"${s.status || ''}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.notes || '').replace(/"/g, '""')}"`,
      `"${selectedDate}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tableflow_staff_roster_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Staff roster exported to CSV successfully!');
  }

  // Send broadcast notification
  async function handleSendBroadcast(e) {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      showToast('Please enter both Title and Message body', 'error');
      return;
    }
    setIsSendingBroadcast(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/broadcast-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: broadcastTarget,
          priority: broadcastPriority,
          title: broadcastTitle,
          body: broadcastBody,
          action_url: broadcastActionUrl
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Broadcast notification dispatched!');
        setBroadcastTitle('');
        setBroadcastBody('');
        setBroadcastActionUrl('');
        fetchBroadcastHistory();
      } else {
        showToast(data.error || 'Failed to dispatch broadcast', 'error');
      }
    } catch {
      showToast('Network error sending broadcast', 'error');
    } finally {
      setIsSendingBroadcast(false);
    }
  }

  // Apply broadcast template
  function applyTemplate(title, body, target = 'all_users', priority = 'normal') {
    setBroadcastTitle(title);
    setBroadcastBody(body);
    setBroadcastTarget(target);
    setBroadcastPriority(priority);
  }

  // Toggle table cleaning task checklist
  function toggleTask(tableId, taskKey) {
    const key = `${tableId}_${taskKey}`;
    setCheckedTasks(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  // Update table cleaning status
  async function handleSetTableStatus(tableId, tableNumber, newStatus) {
    setUpdatingTableId(tableId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/tables/${tableId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
        showToast(
          newStatus === 'available'
            ? `Table #${tableNumber} is now sanitized, bussed and Available!`
            : `Table #${tableNumber} flagged for cleaning.`
        );
      } else {
        showToast('Failed to update table status', 'error');
      }
    } catch {
      showToast('Network error updating table', 'error');
    } finally {
      setUpdatingTableId(null);
    }
  }

  // Derived counts for shifts
  const morningShifts = shifts.filter(s => s.shift_type === 'morning');
  const eveningShifts = shifts.filter(s => s.shift_type === 'evening');
  const nightShifts = shifts.filter(s => s.shift_type === 'night');
  const onDutyCount = shifts.filter(s => s.status === 'on_duty').length;

  const filteredShifts = shifts.filter(s => {
    const matchesType = shiftFilter === 'all' || s.shift_type === shiftFilter;
    const matchesSearch = !searchQuery ||
      s.staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.staff_role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.assigned_section || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Derived counts for tables
  const tablesNeedingCleaning = tables.filter(t => t.status === 'cleaning' || t.status === 'needs_cleaning');
  const tablesOccupied = tables.filter(t => t.status === 'occupied');
  const tablesAvailable = tables.filter(t => t.status === 'available');

  const displayedTables = cleaningFilter === 'cleaning_only'
    ? tablesNeedingCleaning
    : tables;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#059669',
          color: '#ffffff',
          padding: '14px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '600',
          fontSize: '14px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} color="#059669" />
            Staff Roster & Operations Center
          </h1>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Daily shift scheduling (Morning / Evening / Night), emergency push broadcast center & table turnover checklist.
          </p>
        </div>

        {/* Tab Selectors */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '12px',
          gap: '4px',
          border: '1px solid #e2e8f0'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'roster' ? '700' : '500',
              fontSize: '13px',
              background: activeTab === 'roster' ? '#ffffff' : 'transparent',
              color: activeTab === 'roster' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'roster' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Clock size={16} color={activeTab === 'roster' ? '#059669' : '#64748b'} />
            Shift Roster ({shifts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'broadcast' ? '700' : '500',
              fontSize: '13px',
              background: activeTab === 'broadcast' ? '#ffffff' : 'transparent',
              color: activeTab === 'broadcast' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'broadcast' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Radio size={16} color={activeTab === 'broadcast' ? '#2563eb' : '#64748b'} />
            Broadcast Center
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cleaning')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'cleaning' ? '700' : '500',
              fontSize: '13px',
              background: activeTab === 'cleaning' ? '#ffffff' : 'transparent',
              color: activeTab === 'cleaning' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'cleaning' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={16} color={activeTab === 'cleaning' ? '#d97706' : '#64748b'} />
            Table Turnover ({tablesNeedingCleaning.length})
          </button>
        </div>
      </div>

      {/* ========================================================
          TAB 1: STAFF SHIFT ROSTER
          ======================================================== */}
      {activeTab === 'roster' && (
        <div>
          {/* Shift Metric Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Active On Duty</span>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{onDutyCount}</div>
              <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '600', marginTop: '4px' }}>Currently clocked in & active</div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Morning Shift</span>
                <Sun size={18} color="#eab308" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{morningShifts.length} <span style={{ fontSize: '13px', fontWeight: '500', color: '#94a3b8' }}>Staff</span></div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>08:00 AM – 04:00 PM</div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Evening Shift</span>
                <Sunset size={18} color="#f97316" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{eveningShifts.length} <span style={{ fontSize: '13px', fontWeight: '500', color: '#94a3b8' }}>Staff</span></div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>04:00 PM – 12:00 Midnight</div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Night Shift</span>
                <Moon size={18} color="#6366f1" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{nightShifts.length} <span style={{ fontSize: '13px', fontWeight: '500', color: '#94a3b8' }}>Staff</span></div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>12:00 Midnight – 08:00 AM</div>
            </div>
          </div>

          {/* Roster Controls Bar */}
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Date Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <Calendar size={16} color="#64748b" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                {['all', 'morning', 'evening', 'night'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setShiftFilter(type)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: shiftFilter === type ? '700' : '500',
                      background: shiftFilter === type ? '#ffffff' : 'transparent',
                      color: shiftFilter === type ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', minWidth: '220px' }}>
                <Search size={15} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search staff, role, zone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    width: '100%'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                title="View and print official staff shift roster PDF"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#0f172a'; }}
              >
                <FileText size={15} color="#2563eb" />
                Shift Roster (PDF)
              </button>

              <button
                type="button"
                onClick={handleExportRosterCsv}
                title="Download CSV report of shift roster"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.color = '#059669'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#0f172a'; }}
              >
                <Download size={15} color="#059669" />
                Export CSV
              </button>

              <button
                type="button"
                onClick={() => fetchShifts(selectedDate)}
                title="Refresh Roster"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={15} />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => setIsAddShiftOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(5,150,105,0.2)'
                }}
              >
                <Plus size={16} />
                Add Shift Assignment
              </button>
            </div>
          </div>

          {/* Roster Table */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {shiftsLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <RotateCcw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                <p>Loading shift roster for {selectedDate}...</p>
              </div>
            ) : filteredShifts.length === 0 ? (
              <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
                <Clock size={40} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#334155', margin: '0 0 6px 0' }}>No Staff Shifts Found</h3>
                <p style={{ fontSize: '13px', margin: 0, color: '#94a3b8' }}>
                  No shifts matching your filter for {selectedDate}. Click &quot;+ Add Shift Assignment&quot; to assign staff.
                </p>
              </div>
            ) : (
              <div style={{ width: '100%', overflowX: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ width: '23%', padding: '14px 18px' }}>Staff Member</th>
                      <th style={{ width: '22%', padding: '14px 12px' }}>Shift Window</th>
                      <th style={{ width: '16%', padding: '14px 12px' }}>Role / Duty</th>
                      <th style={{ width: '14%', padding: '14px 12px' }}>Assigned Section</th>
                      <th style={{ width: '13%', padding: '14px 12px' }}>Duty Status</th>
                      <th style={{ width: '12%', padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShifts.map((shift) => {
                      const isMorning = shift.shift_type === 'morning';
                      const isEvening = shift.shift_type === 'evening';
                      return (
                        <tr key={shift.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 18px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '34px',
                                height: '34px',
                                minWidth: '34px',
                                borderRadius: '50%',
                                background: isMorning ? '#fef3c7' : isEvening ? '#ffedd5' : '#e0e7ff',
                                color: isMorning ? '#b45309' : isEvening ? '#c2410c' : '#4338ca',
                                display: 'flex',
                                alignItems: 'center',
                                justifySelf: 'center',
                                justifyContent: 'center',
                                fontWeight: '700',
                                fontSize: '13px'
                              }}>
                                {shift.staff_name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{shift.staff_name}</div>
                                {shift.phone && (
                                  <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                    <Phone size={10} />
                                    {shift.phone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '14px 12px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', width: '100%', maxWidth: '175px' }}>
                              <select
                                value={shift.shift_type}
                                onChange={(e) => handleUpdateShiftType(shift.id, e.target.value)}
                                title="Click to quickly switch shift window"
                                style={{
                                  width: '100%',
                                  padding: '5px 8px 5px 24px',
                                  borderRadius: '20px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  border: isMorning ? '1px solid #fde68a' : isEvening ? '1px solid #fed7aa' : '1px solid #c7d2fe',
                                  background: isMorning ? '#fffbeb' : isEvening ? '#fff7ed' : '#eef2ff',
                                  color: isMorning ? '#b45309' : isEvening ? '#c2410c' : '#4338ca',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  appearance: 'none',
                                  WebkitAppearance: 'none'
                                }}
                              >
                                <option value="morning">Morning (08-16)</option>
                                <option value="evening">Evening (16-00)</option>
                                <option value="night">Night (00-08)</option>
                              </select>
                              <div style={{ position: 'absolute', left: '7px', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                                {isMorning ? <Sun size={12} color="#b45309" /> : isEvening ? <Sunset size={12} color="#c2410c" /> : <Moon size={12} color="#4338ca" />}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '14px 12px', overflow: 'hidden' }}>
                            <div style={{ fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {shift.staff_role}
                            </div>
                            {shift.notes && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={shift.notes}>
                                📝 {shift.notes}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '14px 12px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              <MapPin size={13} color="#94a3b8" style={{ minWidth: '13px' }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shift.assigned_section || 'Unassigned'}</span>
                            </div>
                          </td>

                          <td style={{ padding: '14px 12px' }}>
                            <select
                              value={shift.status}
                              onChange={(e) => handleUpdateShiftStatus(shift.id, e.target.value)}
                              style={{
                                width: '100%',
                                maxWidth: '120px',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '700',
                                border: '1px solid #cbd5e1',
                                outline: 'none',
                                cursor: 'pointer',
                                background:
                                  shift.status === 'on_duty' ? '#ecfdf5' :
                                    shift.status === 'scheduled' ? '#eff6ff' :
                                      shift.status === 'completed' ? '#f8fafc' : '#fef2f2',
                                color:
                                  shift.status === 'on_duty' ? '#065f46' :
                                    shift.status === 'scheduled' ? '#1e40af' :
                                      shift.status === 'completed' ? '#475569' : '#991b1b'
                              }}
                            >
                              <option value="on_duty">🟢 On Duty</option>
                              <option value="scheduled">🔵 Scheduled</option>
                              <option value="completed">⚪ Completed</option>
                              <option value="absent">🔴 Absent</option>
                            </select>
                          </td>

                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => openEditShiftModal(shift)}
                                title="Edit Shift Assignment"
                                style={{
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#334155',
                                  cursor: 'pointer',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = '#eff6ff'; }}
                                onMouseOut={(e) => { e.currentTarget.style.color = '#334155'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
                              >
                                <Edit3 size={12} />
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => openDeleteModal(shift)}
                                title="Remove Shift Assignment"
                                style={{
                                  border: '1px solid #fee2e2',
                                  background: '#fff5f5',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.borderColor = '#fee2e2'; }}
                              >
                                <Trash2 size={12} />
                                Delete
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
        </div>
      )}

      {/* ========================================================
          TAB 2: BROADCAST NOTIFICATIONS
          ======================================================== */}
      {activeTab === 'broadcast' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          {/* Dispatch Panel */}
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <Radio size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>Send Real-Time Push Broadcast</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>Dispatches instant notification to customer mobile apps or staff devices.</p>
              </div>
            </div>

            {/* Quick Templates */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                Quick Preset Templates
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => applyTemplate('🍽️ Kitchen Last Call in 15 Minutes', 'Our kitchen will be wrapping up final orders at 10:15 PM. Please place any last-minute dessert or beverage requests now!', 'seated_guests', 'high')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '12px',
                    color: '#334155',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  ⏳ Kitchen Last Call
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('📢 Staff Huddle in 5 Minutes', 'Brief operational synchronization at Host desk. All captains and waiters please attend.', 'staff', 'urgent')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '12px',
                    color: '#334155',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  🧑‍🍳 Staff Huddle
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('🌦️ Weather Advisory: Terrace Relocation', 'Due to sudden rain, outdoor terrace tables are being shifted indoors. Our team will assist you shortly.', 'seated_guests', 'high')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '12px',
                    color: '#334155',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  🌦️ Weather Alert
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('🎉 Weekend Happy Hour Special!', 'Enjoy 20% off all artisan mocktails and appetizers today from 5:00 PM to 7:00 PM at TableFlow.', 'all_users', 'normal')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '12px',
                    color: '#334155',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  🎉 Weekend Promo
                </button>
              </div>
            </div>

            <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Target Audience */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Target Audience
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'all_users', label: '📢 All App Users / Customers', desc: 'Global announcement' },
                    { id: 'seated_guests', label: '🍽️ Seated Guests', desc: 'Currently dining at tables' },
                    { id: 'staff', label: '🧑‍🍳 On-Duty Staff & Waiters', desc: 'Staff alert channel' },
                    { id: 'queue_users', label: '⏳ Waiting Queue Guests', desc: 'Live waitlist parties' }
                  ].map(target => (
                    <div
                      key={target.id}
                      onClick={() => setBroadcastTarget(target.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: broadcastTarget === target.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: broadcastTarget === target.id ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: '700', color: broadcastTarget === target.id ? '#1d4ed8' : '#0f172a' }}>
                        {target.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {target.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Urgency / Priority
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { id: 'normal', label: 'Normal Notification', color: '#10b981', bg: '#ecfdf5' },
                    { id: 'high', label: 'High Priority Alert', color: '#f59e0b', bg: '#fffbeb' },
                    { id: 'urgent', label: 'Urgent Alert (Buzzer)', color: '#ef4444', bg: '#fef2f2' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBroadcastPriority(p.id)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: broadcastPriority === p.id ? `2px solid ${p.color}` : '1px solid #e2e8f0',
                        background: broadcastPriority === p.id ? p.bg : '#ffffff',
                        color: broadcastPriority === p.id ? p.color : '#64748b',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Notification Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kitchen Closing Announcement"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Body */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Message Content *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type the message that will pop up on customer & staff screens..."
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSendingBroadcast}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isSendingBroadcast ? '#94a3b8' : '#2563eb',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: isSendingBroadcast ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                  marginTop: '6px'
                }}
              >
                {isSendingBroadcast ? (
                  <RotateCcw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Send size={18} />
                )}
                {isSendingBroadcast ? 'Dispatching Broadcast Push...' : 'Send Live Broadcast Now'}
              </button>
            </form>
          </div>

          {/* Delivery History Log */}
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BellRing size={18} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Broadcast Activity Log</h3>
              </div>
              <button
                type="button"
                onClick={fetchBroadcastHistory}
                style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
              >
                Refresh
              </button>
            </div>

            {logsLoading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Loading delivery history...
              </div>
            ) : broadcastLogs.length === 0 ? (
              <div style={{ padding: '40px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No broadcast notifications dispatched yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '540px', overflowY: 'auto' }}>
                {broadcastLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid #f1f5f9',
                      background: '#f8fafc'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: log.priority === 'urgent' ? '#fee2e2' : log.priority === 'high' ? '#fef3c7' : '#e0f2fe',
                        color: log.priority === 'urgent' ? '#991b1b' : log.priority === 'high' ? '#92400e' : '#0369a1'
                      }}>
                        {log.target_label || log.target}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                      {log.title}
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.4', marginBottom: '8px' }}>
                      {log.body}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                      <span style={{ color: '#059669', fontWeight: '600' }}>✓ {log.delivery_status}</span>
                      <span>{log.recipients_count} recipient(s)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: TABLE CLEANING & TURNOVER (BUSSING)
          ======================================================== */}
      {activeTab === 'cleaning' && (
        <div>
          {/* Turnover Status Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                <Sparkles size={22} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{tablesNeedingCleaning.length}</div>
                <div style={{ fontSize: '12px', color: '#d97706', fontWeight: '700' }}>Tables Need Cleaning</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{tablesAvailable.length}</div>
                <div style={{ fontSize: '12px', color: '#059669', fontWeight: '700' }}>Ready &amp; Available</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <Users size={22} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{tablesOccupied.length}</div>
                <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700' }}>Currently Occupied</div>
              </div>
            </div>
          </div>

          {/* Filter & Refresh */}
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '14px 20px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setCleaningFilter('cleaning_only')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: cleaningFilter === 'cleaning_only' ? '700' : '500',
                  background: cleaningFilter === 'cleaning_only' ? '#d97706' : '#f1f5f9',
                  color: cleaningFilter === 'cleaning_only' ? '#ffffff' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                Needs Bussing &amp; Turnover ({tablesNeedingCleaning.length})
              </button>

              <button
                type="button"
                onClick={() => setCleaningFilter('all')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: cleaningFilter === 'all' ? '700' : '500',
                  background: cleaningFilter === 'all' ? '#0f172a' : '#f1f5f9',
                  color: cleaningFilter === 'all' ? '#ffffff' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                All Restaurant Tables ({tables.length})
              </button>
            </div>

            <button
              type="button"
              onClick={fetchTables}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={15} />
              Refresh Floor
            </button>
          </div>

          {/* Tables Grid */}
          {tablesLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <RotateCcw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
              <p>Scanning floor plan tables...</p>
            </div>
          ) : displayedTables.length === 0 ? (
            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '60px 20px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <CheckCircle2 size={44} color="#10b981" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>All Tables Sanitized &amp; Ready!</h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                No tables are currently flagged for bussing or cleaning. Great job by the floor turnover team!
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {displayedTables.map((table) => {
                const isNeedsCleaning = table.status === 'cleaning' || table.status === 'needs_cleaning';
                const isAvailable = table.status === 'available';
                const isOccupied = table.status === 'occupied';

                const task1 = checkedTasks[`${table.id}_dishes`];
                const task2 = checkedTasks[`${table.id}_surface`];
                const task3 = checkedTasks[`${table.id}_cutlery`];
                const task4 = checkedTasks[`${table.id}_condiments`];
                const allChecked = task1 && task2 && task3 && task4;

                return (
                  <div
                    key={table.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '14px',
                      border: isNeedsCleaning ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                      padding: '18px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                          Table #{table.table_number}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          ({table.capacity} Pax)
                        </span>
                      </div>

                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '4px 9px',
                        borderRadius: '6px',
                        background: isNeedsCleaning ? '#fef3c7' : isAvailable ? '#ecfdf5' : '#eff6ff',
                        color: isNeedsCleaning ? '#b45309' : isAvailable ? '#065f46' : '#1d4ed8'
                      }}>
                        {isNeedsCleaning ? '🧹 Needs Cleaning' : isAvailable ? '✓ Ready' : '🍽️ Occupied'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                      Zone: <strong>{table.table_categories?.name || 'Main Dining'}</strong>
                    </div>

                    {/* Step-by-Step Bussing Checklist */}
                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckSquare size={13} />
                        Turnover Checklist
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: task1 ? '#059669' : '#334155' }}>
                          <input type="checkbox" checked={Boolean(task1)} onChange={() => toggleTask(table.id, 'dishes')} />
                          <span>Clear soiled dishes &amp; glassware</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: task2 ? '#059669' : '#334155' }}>
                          <input type="checkbox" checked={Boolean(task2)} onChange={() => toggleTask(table.id, 'surface')} />
                          <span>Sanitize tabletop &amp; chair surfaces</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: task3 ? '#059669' : '#334155' }}>
                          <input type="checkbox" checked={Boolean(task3)} onChange={() => toggleTask(table.id, 'cutlery')} />
                          <span>Reset fresh cutlery &amp; napkins</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: task4 ? '#059669' : '#334155' }}>
                          <input type="checkbox" checked={Boolean(task4)} onChange={() => toggleTask(table.id, 'condiments')} />
                          <span>Inspect condiments &amp; sweep area</span>
                        </label>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isNeedsCleaning ? (
                        <button
                          type="button"
                          onClick={() => handleSetTableStatus(table.id, table.table_number, 'available')}
                          disabled={updatingTableId === table.id}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '9px',
                            borderRadius: '8px',
                            border: 'none',
                            background: allChecked ? '#059669' : '#10b981',
                            color: '#ffffff',
                            fontWeight: '700',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          <Sparkles size={14} />
                          {updatingTableId === table.id ? 'Updating...' : 'Mark Clean & Available'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetTableStatus(table.id, table.table_number, 'cleaning')}
                          disabled={updatingTableId === table.id}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#d97706',
                            fontWeight: '600',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          <ShieldAlert size={14} />
                          Flag for Bussing
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: ADD SHIFT ASSIGNMENT
          ======================================================== */}
      {isAddShiftOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Assign Staff Shift
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Schedule duty roster for {selectedDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddShiftOpen(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddShift} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Shift Time Window *
                </label>
                <select
                  value={shiftFormData.shift_type}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, shift_type: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                >
                  <option value="morning">🌅 Morning Shift (08:00 AM – 04:00 PM)</option>
                  <option value="evening">🌇 Evening Shift (04:00 PM – 12:00 Midnight)</option>
                  <option value="night">🌙 Night Shift (12:00 Midnight – 08:00 AM)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Staff Member Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kamal Perera"
                  value={shiftFormData.staff_name}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, staff_name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Role / Position
                  </label>
                  <select
                    value={shiftFormData.staff_role}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, staff_role: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="Head Captain">Head Captain</option>
                    <option value="Floor Waiter">Floor Waiter</option>
                    <option value="Senior Waiter">Senior Waiter</option>
                    <option value="Cashier / POS Host">Cashier / POS Host</option>
                    <option value="Bartender">Bartender</option>
                    <option value="Kitchen Line Cook">Kitchen Line Cook</option>
                    <option value="Night Supervisor">Night Supervisor</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Assigned Section
                  </label>
                  <select
                    value={shiftFormData.assigned_section}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, assigned_section: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="Main Dining Hall">Main Dining Hall</option>
                    <option value="Window & Terrace">Window &amp; Terrace</option>
                    <option value="VIP Area & Dining">VIP Area &amp; Dining</option>
                    <option value="Front Desk & POS">Front Desk &amp; POS</option>
                    <option value="Bar & Lounge">Bar &amp; Lounge</option>
                    <option value="All Restaurant Areas">All Restaurant Areas</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Initial Status
                  </label>
                  <select
                    value={shiftFormData.status}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, status: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="on_duty">On Duty</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="+94 77 123 4567"
                    value={shiftFormData.phone}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, phone: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Shift Notes / Responsibilities
                </label>
                <input
                  type="text"
                  placeholder="e.g. Section 1 lunch supervisor"
                  value={shiftFormData.notes}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddShiftOpen(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingShift}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#059669',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingShift ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingShift ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Shift Modal */}
      {isEditShiftOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit3 size={18} color="#2563eb" />
                  Edit Shift Assignment
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Update duty window, assigned zone, or operational notes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditShiftOpen(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedShift} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Shift Time Window *
                </label>
                <select
                  value={editFormData.shift_type}
                  onChange={(e) => setEditFormData({ ...editFormData, shift_type: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                >
                  <option value="morning">🌅 Morning Shift (08:00 AM – 04:00 PM)</option>
                  <option value="evening">🌇 Evening Shift (04:00 PM – 12:00 Midnight)</option>
                  <option value="night">🌙 Night Shift (12:00 Midnight – 08:00 AM)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Staff Member Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kamal Perera"
                  value={editFormData.staff_name}
                  onChange={(e) => setEditFormData({ ...editFormData, staff_name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Role / Position
                  </label>
                  <select
                    value={editFormData.staff_role}
                    onChange={(e) => setEditFormData({ ...editFormData, staff_role: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="Head Captain">Head Captain</option>
                    <option value="Floor Waiter">Floor Waiter</option>
                    <option value="Senior Waiter">Senior Waiter</option>
                    <option value="Cashier / POS Host">Cashier / POS Host</option>
                    <option value="Bartender">Bartender</option>
                    <option value="Kitchen Line Cook">Kitchen Line Cook</option>
                    <option value="Night Supervisor">Night Supervisor</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Assigned Section
                  </label>
                  <select
                    value={editFormData.assigned_section}
                    onChange={(e) => setEditFormData({ ...editFormData, assigned_section: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="Main Dining Hall">Main Dining Hall</option>
                    <option value="Window & Terrace">Window &amp; Terrace</option>
                    <option value="VIP Area & Dining">VIP Area &amp; Dining</option>
                    <option value="Front Desk & POS">Front Desk &amp; POS</option>
                    <option value="Bar & Lounge">Bar &amp; Lounge</option>
                    <option value="All Restaurant Areas">All Restaurant Areas</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Duty Status
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="scheduled">🔵 Scheduled</option>
                    <option value="on_duty">🟢 On Duty</option>
                    <option value="completed">⚪ Completed</option>
                    <option value="absent">🔴 Absent</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="+94 77 123 4567"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Shift Notes / Responsibilities
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP section evening lead"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditShiftOpen(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingEdit ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Shift Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Danger Delete Confirmation Modal */}
      {isDeleteModalOpen && shiftToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
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
            maxWidth: '440px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #fee2e2',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ padding: '24px 24px 16px 24px', textAlign: 'center' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#ef4444',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <Trash2 size={26} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                Remove Shift Assignment?
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                Are you sure you want to remove <strong style={{ color: '#0f172a' }}>{shiftToDelete.staff_name}</strong> ({shiftToDelete.staff_role}) from the <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{shiftToDelete.shift_type}</span> shift on {selectedDate}?
              </p>
            </div>

            <div style={{
              padding: '16px 24px',
              background: '#f8fafc',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => { setIsDeleteModalOpen(false); setShiftToDelete(null); }}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Keep Assignment
              </button>
              <button
                type="button"
                disabled={isDeletingShift}
                onClick={handleConfirmDeleteShift}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isDeletingShift ? 'not-allowed' : 'pointer'
                }}
              >
                {isDeletingShift ? 'Removing...' : 'Yes, Remove Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Printable / PDF Shift Roster Modal */}
      {isReportModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid #cbd5e1',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                    Official Daily Staff Shift Roster
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Document date: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#059669',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(5,150,105,0.2)'
                  }}
                >
                  <Printer size={15} />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Printable Content */}
            <div
              className="luxury-scrollbar"
              style={{
                padding: '30px',
                overflowY: 'auto',
                flex: 1,
                background: '#ffffff',
                color: '#0f172a'
              }}
            >
              <div id="printable-staff-roster">
                {/* Print Styles */}
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden !important;
                    }
                    #printable-staff-roster, #printable-staff-roster * {
                      visibility: visible !important;
                    }
                    #printable-staff-roster {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      padding: 20px !important;
                      margin: 0 !important;
                    }
                  }
                `}</style>

                {/* Document Letterhead */}
                <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', letterSpacing: '-0.02em', color: '#0f172a' }}>
                      TABLEFLOW RESTAURANT &amp; BAR
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                      Operational Staff Deployment &amp; Duty Roster Sheet
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ROSTER DATE</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Metric Summary Strip */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '24px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Total Roster</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{shifts.length} Staff</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>Active On Duty</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>{onDutyCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '600' }}>Morning Shift</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#b45309' }}>{morningShifts.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#c2410c', fontWeight: '600' }}>Evening Shift</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#c2410c' }}>{eveningShifts.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#4338ca', fontWeight: '600' }}>Night Shift</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#4338ca' }}>{nightShifts.length}</div>
                  </div>
                </div>

                {/* Section Helper Function */}
                {[
                  { title: '🌅 Morning Shift (08:00 AM – 04:00 PM)', list: morningShifts, accent: '#b45309', bg: '#fffbeb' },
                  { title: '🌇 Evening Shift (04:00 PM – 12:00 Midnight)', list: eveningShifts, accent: '#c2410c', bg: '#fff7ed' },
                  { title: '🌙 Night Shift (12:00 Midnight – 08:00 AM)', list: nightShifts, accent: '#4338ca', bg: '#eef2ff' }
                ].map(sec => (
                  <div key={sec.title} style={{ marginBottom: '24px' }}>
                    <div style={{
                      background: sec.bg,
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '800',
                      color: sec.accent,
                      marginBottom: '8px',
                      border: `1px solid ${sec.accent}20`
                    }}>
                      {sec.title} — {sec.list.length} Staff Assigned
                    </div>

                    {sec.list.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', background: '#fafafa', borderRadius: '6px' }}>
                        No staff scheduled for this shift.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', marginBottom: '8px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontWeight: '700' }}>
                            <th style={{ padding: '8px 10px', width: '25%' }}>Staff Member</th>
                            <th style={{ padding: '8px 10px', width: '20%' }}>Position / Role</th>
                            <th style={{ padding: '8px 10px', width: '20%' }}>Assigned Section</th>
                            <th style={{ padding: '8px 10px', width: '15%' }}>Duty Status</th>
                            <th style={{ padding: '8px 10px', width: '20%' }}>Contact / Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sec.list.map(s => (
                            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a' }}>{s.staff_name}</td>
                              <td style={{ padding: '8px 10px', color: '#334155' }}>{s.staff_role}</td>
                              <td style={{ padding: '8px 10px', color: '#475569' }}>{s.assigned_section || 'Unassigned'}</td>
                              <td style={{ padding: '8px 10px', textTransform: 'capitalize', fontWeight: '600' }}>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  background: s.status === 'on_duty' ? '#dcfce7' : s.status === 'scheduled' ? '#dbeafe' : '#f1f5f9',
                                  color: s.status === 'on_duty' ? '#15803d' : s.status === 'scheduled' ? '#1d4ed8' : '#475569'
                                }}>
                                  {s.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', color: '#64748b' }}>
                                {s.phone && <div>📞 {s.phone}</div>}
                                {s.notes && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.notes}</div>}
                                {!s.phone && !s.notes && '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}

                {/* Official Sign-Off Block */}
                <div style={{
                  marginTop: '36px',
                  paddingTop: '20px',
                  borderTop: '2px dashed #cbd5e1',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '20px',
                  pageBreakInside: 'avoid'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '40px' }}>
                      Duty Manager Verification
                    </div>
                    <div style={{ borderBottom: '1px solid #94a3b8', width: '85%' }}></div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>Signature &amp; Date</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '40px' }}>
                      Head Captain / Supervisor
                    </div>
                    <div style={{ borderBottom: '1px solid #94a3b8', width: '85%' }}></div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>Signature &amp; Date</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>
                      Restaurant Seal / Stamp
                    </div>
                    <div style={{
                      border: '1.5px dashed #cbd5e1',
                      borderRadius: '8px',
                      height: '60px',
                      width: '85%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#cbd5e1',
                      fontSize: '11px'
                    }}>
                      Official Seal
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                  Document generated via TableFlow System on {new Date().toLocaleString()} • Confidential Internal Roster
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Use &quot;Print / Save PDF&quot; or browser print dialog (Ctrl+P / Cmd+P) to print or export PDF.
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleExportRosterCsv}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#0f172a',
                    cursor: 'pointer'
                  }}
                >
                  📥 Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
