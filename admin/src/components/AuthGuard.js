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
        // Verify role
        const { data: userRecord } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (userRecord && (userRecord.role === 'admin' || userRecord.role === 'staff')) {
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
