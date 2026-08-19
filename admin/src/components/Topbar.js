"use client";

import { usePathname } from 'next/navigation';

export default function Topbar() {
  const pathname = usePathname();
  
  let title = 'Dashboard';
  let subtitle = 'Live overview of all restaurant operations';

  if (pathname === '/queue') {
    title = 'Live Queue'; subtitle = 'Real-time waitlist management';
  } else if (pathname === '/tables') {
    title = 'Tables & Floor'; subtitle = 'Manage restaurant seating capacity';
  } else if (pathname === '/orders') {
    title = 'Orders'; subtitle = 'Kitchen queue and order management';
  } else if (pathname === '/reservations') {
    title = 'Reservations'; subtitle = 'Upcoming table bookings';
  } else if (pathname === '/menu') {
    title = 'Menu'; subtitle = 'Manage dishes and availability';
  }

  return (
    <div className="topbar">
      <div className="topbar-title">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="topbar-actions">
        <div className="live-badge">
          <div className="live-dot"></div>
          Live
        </div>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>↻ Refresh</button>
      </div>
    </div>
  );
}
