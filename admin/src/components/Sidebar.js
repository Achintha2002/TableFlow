"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Grid, Receipt, CalendarDays, UtensilsCrossed } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (path) => pathname === path ? 'active' : '';

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
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-footer-avatar">A</div>
        <div className="sidebar-footer-info">
          <p>Admin</p>
          <span>Restaurant Manager</span>
        </div>
      </div>
    </aside>
  );
}
