"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Grid, Receipt, CalendarDays, UtensilsCrossed, ShieldCheck, LogOut, FileCheck, Share2, Clock } from 'lucide-react';
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
        const { count, error } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'payment_pending');
        if (!error && count !== null) {
          setPendingAuditCount(count);
        }
      } catch (_) {}
    }
    fetchAuditCount();

    const channel = supabase
      .channel('sidebar_pending_audit')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchAuditCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isActive = (path) => pathname === path ? 'active' : '';

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
        {(profile.rawRole === 'admin' || profile.rawRole === 'manager' || profile.rawRole === 'cashier') && (
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

        {(profile.rawRole === 'admin' || profile.rawRole === 'manager' || profile.rawRole === 'cashier') && (
          <>
            <div className="nav-section-label">Live</div>
            <Link href="/queue" className={`nav-item ${isActive('/queue')}`}>
              <Users size={20} />
              Live Queue
            </Link>
          </>
        )}
        
        {(profile.rawRole === 'admin' || profile.rawRole === 'manager') && (
          <Link href="/tables" className={`nav-item ${isActive('/tables')}`}>
            <Grid size={20} />
            Tables & Floor
          </Link>
        )}
        
        {(profile.rawRole === 'admin' || profile.rawRole === 'manager' || profile.rawRole === 'cashier') && (
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
        
        {(profile.rawRole === 'admin' || profile.rawRole === 'manager') && (
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
          </>
        )}
        
        {(profile.rawRole === 'admin' || profile.rawRole === 'manager') && (
          <Link href="/reports" className={`nav-item ${isActive('/reports')}`}>
            <Grid size={20} />
            Reports & Analytics
          </Link>
        )}
        
        {(profile.rawRole === 'admin' || profile.rawRole === 'manager') && (
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
          <div className="sidebar-footer-avatar">
            {profile.name.charAt(0).toUpperCase()}
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
