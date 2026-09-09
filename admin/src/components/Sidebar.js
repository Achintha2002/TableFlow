"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Grid, Receipt, CalendarDays, UtensilsCrossed, ShieldCheck, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState({ name: 'Loading...', role: '' });

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: userRecord } = await supabase.from('users').select('full_name, role').eq('id', session.user.id).single();
        if (userRecord) {
          setProfile({
            name: userRecord.full_name || session.user.email.split('@')[0],
            role: userRecord.role === 'admin' ? 'Administrator' : 'Staff Member'
          });
        }
      }
    }
    loadProfile();
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
        <div className="nav-section-label">Overview</div>
        <Link href="/" className={`nav-item ${isActive('/')}`}>
          <LayoutDashboard size={20} />
          Dashboard
        </Link>
        <div className="nav-section-label">Live</div>
        <Link href="/queue" className={`nav-item ${isActive('/queue')}`}>
          <Users size={20} />
          Live Queue
        </Link>
        <Link href="/tables" className={`nav-item ${isActive('/tables')}`}>
          <Grid size={20} />
          Tables & Floor
        </Link>
        <div className="nav-section-label">Operations</div>
        <Link href="/orders" className={`nav-item ${isActive('/orders')}`}>
          <Receipt size={20} />
          Orders
        </Link>
        <Link href="/reservations" className={`nav-item ${isActive('/reservations')}`}>
          <CalendarDays size={20} />
          Reservations
        </Link>
        <Link href="/menu" className={`nav-item ${isActive('/menu')}`}>
          <UtensilsCrossed size={20} />
          Menu
        </Link>
        <div className="nav-section-label">Management</div>
        <Link href="/users" className={`nav-item ${isActive('/users')}`}>
          <ShieldCheck size={20} />
          Users & Admins
        </Link>
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
