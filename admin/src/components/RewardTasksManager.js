"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Award,
  Calendar,
  Flame,
  Utensils,
  Star,
  Coffee,
  Check,
  Send,
  Users,
  Copy,
  ChevronRight,
  TrendingUp,
  Percent,
  Clock
} from 'lucide-react';

const ICON_MAP = {
  restaurant: Utensils,
  calendar: Calendar,
  flame: Flame,
  star: Star,
  award: Award,
  coffee: Coffee
};

const TRIGGER_LABELS = {
  dine_in_orders: 'Served Dine-In Orders',
  weekday_booking: 'Mon–Thu Reservation',
  chef_special: "Chef's Special Dishes",
  min_spend: 'Minimum Order Spend',
  custom_manual: 'Manual Admin Award'
};

const DEFAULT_TASKS = [
  {
    task_key: 'dine_3_orders',
    title: 'Dine-In Explorer',
    description: 'Complete 3 served dine-in meals at TableFlow to unlock 10% OFF.',
    icon_type: 'restaurant',
    target_progress: 3,
    reward_discount_percent: 10,
    trigger_type: 'dine_in_orders',
    is_active: true
  },
  {
    task_key: 'weekday_booking',
    title: 'Weekday Gourmet',
    description: 'Book and complete a table reservation between Monday and Thursday.',
    icon_type: 'calendar',
    target_progress: 1,
    reward_discount_percent: 10,
    trigger_type: 'weekday_booking',
    is_active: true
  },
  {
    task_key: 'chef_special',
    title: "Chef's Signature Fan",
    description: "Order any signature dish from our Chef's Special menu.",
    icon_type: 'flame',
    target_progress: 1,
    reward_discount_percent: 10,
    trigger_type: 'chef_special',
    is_active: true
  }
];

export default function RewardTasksManager({ showToast }) {
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tableNotCreated, setTableNotCreated] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTrigger, setFilterTrigger] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    task_key: '',
    description: '',
    icon_type: 'restaurant',
    target_progress: 1,
    reward_discount_percent: 10,
    trigger_type: 'dine_in_orders',
    trigger_value: '',
    is_active: true
  });

  // Award Modal
  const [awardModalOpen, setAwardModalOpen] = useState(false);
  const [selectedTaskKey, setSelectedTaskKey] = useState('');
  const [awardAudience, setAwardAudience] = useState('all');
  const [awardAction, setAwardAction] = useState('complete'); // 'complete' | 'increment'
  const [awarding, setAwarding] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch tasks
  async function fetchTasks(isManual = false) {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/reward-tasks');
      const json = await res.json();
      if (!res.ok) {
        const errMsg = json.error || '';
        if (errMsg.includes('schema cache') || errMsg.includes('reward_tasks') || errMsg.includes('not find the table')) {
          setTableNotCreated(true);
          setTasks(DEFAULT_TASKS);
          return;
        }
        throw new Error(errMsg || 'Failed to fetch tasks');
      }
      setTableNotCreated(Boolean(json.tableNotCreated));
      const loaded = (json.tasks && json.tasks.length > 0) ? json.tasks : DEFAULT_TASKS;
      setTasks(loaded);
    } catch (err) {
      console.error('Fetch tasks error:', err);
      setTasks(DEFAULT_TASKS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Fetch customers for award modal
  async function fetchCustomersList() {
    setLoadingCustomers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) {
        setCustomers(data);
      }
    } catch (_) {}
    finally {
      setLoadingCustomers(false);
    }
  }

  useEffect(() => {
    fetchTasks();

    // Realtime listener for reward_tasks & user_discount_tasks
    const channel = supabase
      .channel('admin_reward_tasks_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_tasks' }, () => {
        fetchTasks();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_discount_tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const q = searchQuery.toLowerCase();
      const matchQuery = !q || (t.title?.toLowerCase().includes(q) || t.task_key?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
      const matchTrigger = filterTrigger === 'ALL' || t.trigger_type === filterTrigger;
      const matchStatus = filterStatus === 'ALL' || (filterStatus === 'ACTIVE' ? t.is_active : !t.is_active);
      return matchQuery && matchTrigger && matchStatus;
    });
  }, [tasks, searchQuery, filterTrigger, filterStatus]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const active = tasks.filter(t => t.is_active).length;
    let completed = 0;
    let claimed = 0;
    tasks.forEach(t => {
      if (t.stats) {
        completed += (t.stats.completedCount || 0);
        claimed += (t.stats.claimedCount || 0);
      }
    });
    return { total, active, completed, claimed };
  }, [tasks]);

  // Open Create Modal
  function handleOpenCreate() {
    setEditingTask(null);
    setFormData({
      title: '',
      task_key: '',
      description: '',
      icon_type: 'restaurant',
      target_progress: 1,
      reward_discount_percent: 10,
      trigger_type: 'dine_in_orders',
      trigger_value: '',
      is_active: true
    });
    setModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(task) {
    setEditingTask(task);
    setFormData({
      title: task.title || '',
      task_key: task.task_key || '',
      description: task.description || '',
      icon_type: task.icon_type || 'restaurant',
      target_progress: task.target_progress || 1,
      reward_discount_percent: task.reward_discount_percent || 10,
      trigger_type: task.trigger_type || 'dine_in_orders',
      trigger_value: task.trigger_value ? String(task.trigger_value) : '',
      is_active: Boolean(task.is_active)
    });
    setModalOpen(true);
  }

  // Submit Create / Edit
  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      if (showToast) showToast('Please enter title and description', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const url = '/api/admin/reward-tasks';
      const method = editingTask ? 'PUT' : 'POST';
      const body = editingTask ? { id: editingTask.id, ...formData } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save task');

      if (showToast) showToast(editingTask ? 'Task updated successfully!' : 'New task created & synced!', 'success');
      setModalOpen(false);
      fetchTasks();
    } catch (err) {
      if (showToast) showToast('Failed: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Toggle Active
  async function handleToggleActive(task) {
    try {
      const nextActive = !task.is_active;
      const res = await fetch('/api/admin/reward-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, is_active: nextActive })
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      if (showToast) showToast(`Task ${nextActive ? 'activated' : 'paused'}`, 'success');
      fetchTasks();
    } catch (err) {
      if (showToast) showToast('Error: ' + err.message, 'error');
    }
  }

  // Open Award Modal
  function handleOpenAward(taskKey = '') {
    const list = tasks.length > 0 ? tasks : DEFAULT_TASKS;
    setSelectedTaskKey(taskKey || (list[0]?.task_key || 'dine_3_orders'));
    setAwardAudience('all');
    setAwardAction('complete');
    setAwardModalOpen(true);
    fetchCustomersList();
  }

  // Submit Manual Award
  async function handleAwardSubmit(e) {
    e.preventDefault();
    if (!selectedTaskKey) {
      if (showToast) showToast('Please select a task', 'error');
      return;
    }

    setAwarding(true);
    try {
      const res = await fetch('/api/admin/reward-tasks/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_key: selectedTaskKey,
          user_id: awardAudience,
          action: awardAction
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Award failed');

      if (showToast) showToast(json.message || 'Task awarded successfully in real-time!', 'success');
      setAwardModalOpen(false);
      fetchTasks();
    } catch (err) {
      if (showToast) showToast('Award error: ' + err.message, 'error');
    } finally {
      setAwarding(false);
    }
  }

  // Open Delete Modal
  function handleOpenDelete(task) {
    setTaskToDelete(task);
    setDeleteModalOpen(true);
  }

  // Confirm Delete
  async function handleConfirmDelete() {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reward-tasks?id=${taskToDelete.id}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete task');

      if (showToast) showToast('Task deleted successfully', 'success');
      setDeleteModalOpen(false);
      setTaskToDelete(null);
      fetchTasks();
    } catch (err) {
      if (showToast) showToast('Delete error: ' + err.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header / Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 800,
            color: '#1a1918',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Sparkles size={22} color="#D4AF37" />
            Customer Reward Tasks & Gamification
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#78716c' }}>
            Create automated challenges for diners to complete meals or bookings and earn voucher discounts in real time.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchTasks(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1px solid #e7e5e4',
              background: '#ffffff',
              color: '#44403c',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => handleOpenAward()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '10px',
              border: '1px solid #d4af37',
              background: '#fffdf5',
              color: '#854d0e',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Award size={15} color="#d4af37" />
            <span>Award / Test Customer</span>
          </button>

          <button
            onClick={handleOpenCreate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
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
            <span>Create New Task</span>
          </button>
        </div>
      </div>

      {/* Database Setup Banner if table missing */}
      {tableNotCreated && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '14px',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="#d97706" />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#92400e' }}>
              Database Setup: `reward_tasks` table not found in Supabase
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#b45309', lineHeight: 1.5 }}>
            Running in fallback mode. To enable custom DB persistence and Realtime replication, run the migration in your Supabase SQL editor:
            {' '}<a href="https://supabase.com/dashboard/project/azjjndqecpemltvdbkvy/sql" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', fontWeight: 700 }}>
              Open Supabase SQL Editor
            </a>
          </p>
          <div>
            <button
              onClick={() => {
                const sql = `-- Run in Supabase SQL editor
CREATE TABLE IF NOT EXISTS public.reward_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_type TEXT NOT NULL DEFAULT 'restaurant',
  target_progress INT NOT NULL DEFAULT 1,
  reward_discount_percent INT NOT NULL DEFAULT 10,
  trigger_type TEXT NOT NULL DEFAULT 'dine_in_orders',
  trigger_value NUMERIC DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.reward_tasks;
ALTER TABLE public.reward_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view active reward tasks" ON public.reward_tasks FOR SELECT USING (true);
CREATE POLICY "Service role manage reward_tasks" ON public.reward_tasks FOR ALL USING (true) WITH CHECK (true);`;
                navigator.clipboard.writeText(sql);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 3000);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #d97706',
                background: '#ffffff',
                color: '#92400e',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {copiedSql ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              <span>{copiedSql ? 'Copied Migration SQL!' : 'Copy SQL Script'}</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #f5f5f4',
          padding: '18px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Challenges</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={16} color="#78716c" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#1c1917', marginTop: '8px' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '11px', color: '#a8a29e', marginTop: '4px' }}>Configured gamified challenges</div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #f5f5f4',
          padding: '18px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active In App</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', marginTop: '8px' }}>
            {stats.active}
          </div>
          <div style={{ fontSize: '11px', color: '#a8a29e', marginTop: '4px' }}>Live on customer screens</div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #f5f5f4',
          padding: '18px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completions</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="#d97706" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#d97706', marginTop: '8px' }}>
            {stats.completed}
          </div>
          <div style={{ fontSize: '11px', color: '#a8a29e', marginTop: '4px' }}>Completed by diners</div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #f5f5f4',
          padding: '18px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rewards Claimed</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fdf4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Percent size={16} color="#a855f7" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#9333ea', marginTop: '8px' }}>
            {stats.claimed}
          </div>
          <div style={{ fontSize: '11px', color: '#a8a29e', marginTop: '4px' }}>Vouchers unlocked & added to wallets</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e7e5e4',
        padding: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: '#f5f5f4',
          padding: '8px 14px',
          borderRadius: '10px',
          flex: '1 1 240px',
          maxWidth: '360px'
        }}>
          <Search size={16} color="#78716c" />
          <input
            type="text"
            placeholder="Search task by title, key, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              width: '100%',
              color: '#1c1917'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="#78716c" />
            <select
              value={filterTrigger}
              onChange={(e) => setFilterTrigger(e.target.value)}
              style={{
                fontSize: '12px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e7e5e4',
                background: '#ffffff',
                color: '#44403c',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Triggers</option>
              <option value="dine_in_orders">Served Meals</option>
              <option value="weekday_booking">Mon-Thu Booking</option>
              <option value="chef_special">Chef's Special</option>
              <option value="min_spend">Minimum Spend</option>
              <option value="custom_manual">Manual Award</option>
            </select>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              fontSize: '12px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #e7e5e4',
              background: '#ffffff',
              color: '#44403c',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="PAUSED">Paused Only</option>
          </select>
        </div>
      </div>

      {/* Task Cards Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#78716c' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div>Loading reward tasks...</div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px dashed #d6d3d1',
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <Award size={40} color="#d6d3d1" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#44403c' }}>No tasks found</h4>
          <p style={{ margin: '6px 0 16px', fontSize: '13px', color: '#78716c' }}>
            Create your first gamified challenge to engage diners with instant voucher rewards!
          </p>
          <button
            onClick={handleOpenCreate}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: '#B87F5C',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            + Create New Task
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px'
        }}>
          {filteredTasks.map((task) => {
            const IconComponent = ICON_MAP[task.icon_type] || Utensils;
            const triggerLabel = TRIGGER_LABELS[task.trigger_type] || task.trigger_type;

            return (
              <div
                key={task.id || task.task_key}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: task.is_active ? '1px solid #e7e5e4' : '1px dashed #d6d3d1',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s ease',
                  opacity: task.is_active ? 1 : 0.75
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: task.icon_type === 'flame'
                        ? 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)'
                        : task.icon_type === 'calendar'
                        ? 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)'
                        : task.icon_type === 'star'
                        ? 'linear-gradient(135deg, #fef9c3 0%, #fde047 100%)'
                        : 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                    }}>
                      <IconComponent
                        size={22}
                        color={
                          task.icon_type === 'flame' ? '#ea580c' :
                          task.icon_type === 'calendar' ? '#0284c7' :
                          task.icon_type === 'star' ? '#ca8a04' : '#16a34a'
                        }
                      />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1c1917' }}>
                        {task.title}
                      </h4>
                      <code style={{
                        fontSize: '11px',
                        color: '#78716c',
                        background: '#f5f5f4',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'inline-block',
                        marginTop: '2px'
                      }}>
                        {task.task_key}
                      </code>
                    </div>
                  </div>

                  {/* Active / Paused Pill */}
                  <button
                    onClick={() => handleToggleActive(task)}
                    title={task.is_active ? 'Click to Pause' : 'Click to Activate'}
                    style={{
                      border: 'none',
                      background: task.is_active ? '#ecfdf5' : '#f5f5f4',
                      color: task.is_active ? '#059669' : '#78716c',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: task.is_active ? '#10b981' : '#a8a29e'
                    }} />
                    <span>{task.is_active ? 'Active' : 'Paused'}</span>
                  </button>
                </div>

                {/* Description */}
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#57534e',
                  lineHeight: 1.5,
                  minHeight: '40px'
                }}>
                  {task.description}
                </p>

                {/* Badges / Rules */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  padding: '10px 12px',
                  background: '#fafaf9',
                  borderRadius: '10px',
                  fontSize: '12px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 700,
                    color: '#92400e',
                    background: '#fef3c7',
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}>
                    <Percent size={12} />
                    <span>{task.reward_discount_percent}% OFF</span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600,
                    color: '#1e40af',
                    background: '#dbeafe',
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}>
                    <span>Target: {task.target_progress} step{task.target_progress > 1 ? 's' : ''}</span>
                  </div>

                  <div style={{
                    fontSize: '11px',
                    color: '#44403c',
                    fontWeight: 500
                  }}>
                    Trigger: <strong style={{ color: '#1c1917' }}>{triggerLabel}</strong>
                    {task.trigger_value ? ` (Rs. ${task.trigger_value}+)` : ''}
                  </div>
                </div>

                {/* Engagement Stats */}
                {task.stats && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    color: '#78716c',
                    borderTop: '1px solid #f5f5f4',
                    paddingTop: '10px'
                  }}>
                    <span>In Progress: <strong style={{ color: '#44403c' }}>{task.stats.activeCount || 0}</strong></span>
                    <span>Completed: <strong style={{ color: '#d97706' }}>{task.stats.completedCount || 0}</strong></span>
                    <span>Claimed: <strong style={{ color: '#16a34a' }}>{task.stats.claimedCount || 0}</strong></span>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: 'auto',
                  borderTop: '1px solid #f5f5f4',
                  paddingTop: '12px'
                }}>
                  <button
                    onClick={() => handleOpenAward(task.task_key)}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #fde68a',
                      background: '#fffbeb',
                      color: '#92400e',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Award size={14} color="#d97706" />
                    <span>Award to Diner</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(task)}
                    title="Edit Task"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #e7e5e4',
                      background: '#ffffff',
                      color: '#57534e',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit3 size={14} />
                  </button>

                  <button
                    onClick={() => handleOpenDelete(task)}
                    title="Delete Task"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #fee2e2',
                      background: '#fff1f2',
                      color: '#dc2626',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT TASK MODAL */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '540px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={20} color="#D4AF37" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1c1917' }}>
                  {editingTask ? 'Edit Reward Task' : 'Create New Gamified Task'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#78716c' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekend Feast Master, Chef's Special Fan"
                  value={formData.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    const autoKey = editingTask ? formData.task_key : title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
                    setFormData({ ...formData, title, task_key: autoKey });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d6d3d1',
                    fontSize: '13px',
                    color: '#1c1917'
                  }}
                />
              </div>

              {/* Task Key */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                  Task Identifier Key (Unique Slug)
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingTask)}
                  placeholder="e.g. weekend_feast_2_orders"
                  value={formData.task_key}
                  onChange={(e) => setFormData({ ...formData, task_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '') })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d6d3d1',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: editingTask ? '#78716c' : '#1c1917',
                    background: editingTask ? '#f5f5f4' : '#ffffff'
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                  Description (Visible in App) *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Complete 2 served dine-in meals at TableFlow on weekends to unlock 15% OFF."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d6d3d1',
                    fontSize: '13px',
                    color: '#1c1917',
                    lineHeight: 1.4
                  }}
                />
              </div>

              {/* Icon & Reward Discount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                    Icon Style
                  </label>
                  <select
                    value={formData.icon_type}
                    onChange={(e) => setFormData({ ...formData, icon_type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #d6d3d1',
                      fontSize: '13px',
                      color: '#1c1917',
                      background: '#ffffff'
                    }}
                  >
                    <option value="restaurant">🍴 Meal / Dining</option>
                    <option value="calendar">📅 Calendar / Booking</option>
                    <option value="flame">🔥 Chef Special / Flame</option>
                    <option value="star">⭐ Star VIP</option>
                    <option value="award">🏆 Trophy / Award</option>
                    <option value="coffee">☕ Cafe / Drinks</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                    Reward Discount (%)
                  </label>
                  <select
                    value={formData.reward_discount_percent}
                    onChange={(e) => setFormData({ ...formData, reward_discount_percent: parseInt(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #d6d3d1',
                      fontSize: '13px',
                      color: '#1c1917',
                      background: '#ffffff'
                    }}
                  >
                    <option value={5}>5% OFF</option>
                    <option value={10}>10% OFF (Standard)</option>
                    <option value={15}>15% OFF</option>
                    <option value={20}>20% OFF (VIP)</option>
                    <option value={25}>25% OFF</option>
                  </select>
                </div>
              </div>

              {/* Target Steps & Trigger Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                    Target Steps (1–10)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.target_progress}
                    onChange={(e) => setFormData({ ...formData, target_progress: parseInt(e.target.value) || 1 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #d6d3d1',
                      fontSize: '13px',
                      color: '#1c1917'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                    Trigger Condition
                  </label>
                  <select
                    value={formData.trigger_type}
                    onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #d6d3d1',
                      fontSize: '13px',
                      color: '#1c1917',
                      background: '#ffffff'
                    }}
                  >
                    <option value="dine_in_orders">Served Dine-In Orders</option>
                    <option value="weekday_booking">Mon–Thu Table Reservation</option>
                    <option value="chef_special">Chef's Special Items</option>
                    <option value="min_spend">Minimum Order Spend</option>
                    <option value="custom_manual">Custom / Admin Manual</option>
                  </select>
                </div>
              </div>

              {/* Minimum spend field if trigger_type == min_spend */}
              {formData.trigger_type === 'min_spend' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                    Minimum Spend Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 3500"
                    value={formData.trigger_value}
                    onChange={(e) => setFormData({ ...formData, trigger_value: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #d6d3d1',
                      fontSize: '13px',
                      color: '#1c1917'
                    }}
                  />
                </div>
              )}

              {/* Active Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1c1917' }}>
                  Enable task immediately in customer app
                </span>
              </label>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: '1px solid #d6d3d1',
                    background: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
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
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #B87F5C 0%, #9c6848 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(184, 127, 92, 0.4)'
                  }}
                >
                  {submitting ? 'Saving...' : editingTask ? 'Update Task' : 'Publish Challenge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AWARD TO DINER MODAL */}
      {awardModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '500px',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={22} color="#D4AF37" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1c1917' }}>
                  Award Task Progress to Customer
                </h3>
              </div>
              <button
                onClick={() => setAwardModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#78716c' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#78716c', lineHeight: 1.5 }}>
              Instantly advance or complete a challenge for customers. The customer's mobile app will reflect this progress in real time!
            </p>

            <form onSubmit={handleAwardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                  Select Challenge Task *
                </label>
                <select
                  required
                  value={selectedTaskKey}
                  onChange={(e) => setSelectedTaskKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d6d3d1',
                    fontSize: '13px',
                    color: '#1c1917',
                    background: '#ffffff'
                  }}
                >
                  {(tasks.length > 0 ? tasks : DEFAULT_TASKS).map(t => (
                    <option key={t.task_key} value={t.task_key}>
                      {t.title} ({t.reward_discount_percent}% OFF)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                  Target Recipient *
                </label>
                <select
                  value={awardAudience}
                  onChange={(e) => setAwardAudience(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d6d3d1',
                    fontSize: '13px',
                    color: '#1c1917',
                    background: '#ffffff'
                  }}
                >
                  <option value="all">🌟 All Registered Users ({customers.length || 'All'})</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      👤 {c.role ? `[${c.role.toUpperCase()}] ` : ''}{c.full_name || 'User'} ({c.email || c.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403c', marginBottom: '6px' }}>
                  Action
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setAwardAction('complete')}
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      border: awardAction === 'complete' ? '2px solid #16a34a' : '1px solid #e7e5e4',
                      background: awardAction === 'complete' ? '#f0fdf4' : '#ffffff',
                      color: awardAction === 'complete' ? '#16a34a' : '#44403c',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    🎉 Complete (100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAwardAction('increment')}
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      border: awardAction === 'increment' ? '2px solid #d97706' : '1px solid #e7e5e4',
                      background: awardAction === 'increment' ? '#fffbeb' : '#ffffff',
                      color: awardAction === 'increment' ? '#d97706' : '#44403c',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ➕ Add +1 Progress
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setAwardModalOpen(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: '1px solid #d6d3d1',
                    background: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={awarding}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  {awarding ? 'Awarding...' : 'Send Real-time Award'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && taskToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            textAlign: 'center'
          }}>
            <Trash2 size={36} color="#dc2626" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#1c1917' }}>
              Delete Task Challenge?
            </h4>
            <p style={{ margin: '8px 0 20px', fontSize: '13px', color: '#78716c', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{taskToDelete.title}"</strong>? Unclaimed progress for this challenge will be removed.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteModalOpen(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid #d6d3d1',
                  background: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
