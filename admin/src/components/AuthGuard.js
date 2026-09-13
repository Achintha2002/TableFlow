"use client";
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AuthGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [isLoginRoute, setIsLoginRoute] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsLoginRoute(pathname === '/login');
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        checkSession();
      } else if (event === 'SIGNED_OUT') {
        setAuthorized(false);
        if (pathname !== '/login') {
          router.push('/login');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setAuthorized(false);
        if (pathname !== '/login') {
          router.push('/login');
        }
      } else {
        // Verify role securely via backend to bypass RLS recursion
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) throw new Error('Session lost');

        const res = await fetch('http://localhost:3000/api/admin/my-role', {
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`
          }
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch role');
        }
        
        const { role } = await res.json();

        const allowedRoles = ['admin', 'manager', 'cashier', 'kitchen', 'staff'];
        if (role && allowedRoles.includes(role)) {
          setAuthorized(true);
          if (pathname === '/login') {
            router.push('/');
          }
        } else {
          // Log out unauthorized users
          await supabase.auth.signOut();
          alert("Access Denied: You do not have permission to view the Admin Dashboard.");
        }
      }
    } catch (e) {
      console.error("Auth check failed:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-base)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Verifying access...</p>
      </div>
    );
  }

  // If on login route, render just children (no sidebar/topbar)
  if (isLoginRoute) {
    return children;
  }

  // If not authorized and not on login, render nothing (will redirect)
  if (!authorized) {
    return null;
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
