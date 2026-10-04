"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Grid, Receipt, CalendarDays, UtensilsCrossed, ShieldCheck, LogOut, FileCheck, Share2, Clock, TicketPercent } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState({ name: 'Loading...', role: '' });
  const [pendingAuditCount, setPendingAuditCount] = useState(0);

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const res = await fetch('http://localhost:3000/api/admin/my-role', {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const roleLabels = {
              'super_admin': 'Super Administrator',
              'admin': 'Administrator',
              'manager': 'Manager',
              'cashier': 'Cashier',
              'kitchen': 'Kitchen Staff',
              'staff': 'Staff Member'
            };
            setProfile({
              name: data.full_name || data.email.split('@')[0],
              role: roleLabels[data.role] || 'Staff',
              rawRole: data.role
            });
          }
        } catch (e) {
          console.error("Failed to load profile in sidebar", e);
        }
      }
    }
    loadProfile();

    async function fetchAuditCount() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, status, payment_status, special_notes')
          .not('status', 'in', '("cancelled","served","completed","payment_rejected")')
          .not('payment_status', 'eq', 'paid')
          .not('payment_status', 'eq', 'failed');

        if (!error && data) {
          const pending = data.filter(o => {
            const notes = (o.special_notes || '').toLowerCase();
            if (notes.includes('[rejected:') || notes.includes('payment rejected') || notes.includes('payment_rejected')) return false;
            return (o.payment_method === 'bank_transfer') || 
                   o.status === 'payment_pending' || 
                   notes.includes('bank transfer') || 
                   notes.includes('[bank transfer ref:');
          });
          setPendingAuditCount(pending.length);
        }
      } catch (_) {}
    }
    fetchAuditCount();

    const channelId = Math.random().toString(36).substring(2, 9);
    const orderChannel = supabase
      .channel(`sidebar_orders_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchAuditCount();
      })
      .subscribe();

    const transChannel = supabase
      .channel(`sidebar_trans_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions' }, () => {
        fetchAuditCount();
      })
      .subscribe();

    let bc = null;
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        bc = new BroadcastChannel('tableflow_orders_channel');
        bc.onmessage = () => fetchAuditCount();
      }
    } catch (_) {}

    const onStorage = (e) => {
      if (e.key === 'tableflow_orders_last_updated') fetchAuditCount();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', fetchAuditCount);
    const interval = setInterval(fetchAuditCount, 8000);

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(transChannel);
      if (bc) bc.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', fetchAuditCount);
      clearInterval(interval);
    };
  }, []);

  const isActive = (path) => pathname === path ? 'active' : '';
  const isAdmin = profile.rawRole === 'admin' || profile.rawRole === 'super_admin';
  const isManager = profile.rawRole === 'manager' || isAdmin;
  const isCashier = profile.rawRole === 'cashier' || isManager;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>TableFlow</h1>
        <p>Admin Console</p>
      </div>
      <nav className="sidebar-nav">
        {isCashier && (
          <>
            <div className="nav-section-label">Overview</div>
            <Link href="/" className={`nav-item ${isActive('/')}`}>
              <LayoutDashboard size={20} />
              Dashboard
            </Link>
          </>
        )}
        
        {profile.rawRole === 'kitchen' && (
          <>
            <div className="nav-section-label">Kitchen Display</div>
            <Link href="/kds" className={`nav-item ${isActive('/kds')}`}>
              <LayoutDashboard size={20} />
              KDS Screen
            </Link>
          </>
        )}

        {isCashier && (
          <>
            <div className="nav-section-label">Live</div>
            <Link href="/queue" className={`nav-item ${isActive('/queue')}`}>
              <Users size={20} />
              Live Queue
            </Link>
          </>
        )}
        
        {isManager && (
          <Link href="/tables" className={`nav-item ${isActive('/tables')}`}>
            <Grid size={20} />
            Tables & Floor
          </Link>
        )}
        
        {isCashier && (
          <>
            <div className="nav-section-label">Operations</div>
            <Link href="/pos" className={`nav-item ${isActive('/pos')}`}>
              <Receipt size={20} />
              Cashier POS & Billing
            </Link>
            <Link href="/orders" className={`nav-item ${isActive('/orders')}`}>
              <Receipt size={20} />
              Orders
            </Link>
            <Link href="/payment-audit" className={`nav-item ${isActive('/payment-audit')}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCheck size={20} color={pendingAuditCount > 0 ? '#f59e0b' : 'currentColor'} />
                Payment Audit
              </span>
              {pendingAuditCount > 0 && (
                <span style={{
                  background: '#f59e0b',
                  color: '#000',
                  borderRadius: '10px',
                  padding: '1px 7px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  boxShadow: '0 2px 5px rgba(245, 158, 11, 0.4)'
                }}>
                  {pendingAuditCount}
                </span>
              )}
            </Link>
          </>
        )}
        
        {isManager && (
          <>
            <Link href="/reservations" className={`nav-item ${isActive('/reservations')}`}>
              <CalendarDays size={20} />
              Reservations
            </Link>
            <Link href="/partner-sync" className={`nav-item ${isActive('/partner-sync')}`}>
              <Share2 size={20} />
              Partner Sync
            </Link>
            <Link href="/menu" className={`nav-item ${isActive('/menu')}`}>
              <UtensilsCrossed size={20} />
              Menu
            </Link>
            <Link href="/promotions" className={`nav-item ${isActive('/promotions')}`}>
              <TicketPercent size={20} />
              Promotions & Vouchers
            </Link>
          </>
        )}
        
        {isManager && (
          <Link href="/reports" className={`nav-item ${isActive('/reports')}`}>
            <Grid size={20} />
            Reports & Analytics
          </Link>
        )}
        
        {isAdmin && (
          <>
            <div className="nav-section-label">Management</div>
            <Link href="/staff-roster" className={`nav-item ${isActive('/staff-roster')}`}>
              <Clock size={20} />
              Staff Roster &amp; Ops
            </Link>
            <Link href="/users" className={`nav-item ${isActive('/users')}`}>
              <ShieldCheck size={20} />
              Users & Staff
            </Link>
          </>
        )}
      </nav>
      <div className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
          <div className="sidebar-footer-avatar" style={{
            background: profile.rawRole === 'super_admin' ? 'linear-gradient(135deg, #d4af37, #f59e0b)' : 'var(--primary)',
            boxShadow: profile.rawRole === 'super_admin' ? '0 0 10px rgba(212, 175, 55, 0.5)' : 'none'
          }}>
            {profile.rawRole === 'super_admin' ? '👑' : profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-footer-info" style={{ overflow: 'hidden' }}>
            <p style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.name}</p>
            <span>{profile.role}</span>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          title="Logout"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
          onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
