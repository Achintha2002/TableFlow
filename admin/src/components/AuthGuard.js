"use client";
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, getSafeSession } from '../lib/supabase';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'cashier', 'kitchen', 'staff'];

export default function AuthGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isCheckingRef = useRef(false);

  const isLoginRoute = pathname === '/login';

  useEffect(() => {
    // 1. If user is directly accessing /login, never block with loading screen
    if (isLoginRoute) {
      setLoading(false);
    }

    // 2. Fallback timer: NEVER let the user stay stuck on loading for more than 3s
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
      if (!authorized && pathname !== '/login') {
        router.replace('/login');
      }
    }, 3000);

    async function checkAuth() {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        const session = await getSafeSession(1500);

        if (!session) {
          setAuthorized(false);
          if (pathname !== '/login') {
            router.replace('/login');
          }
        } else {
          // Check role from session metadata first for instant UI response
          const metaRole = session.user?.user_metadata?.role;
          const isMetaAllowed = metaRole && ALLOWED_ROLES.includes(metaRole);

          if (isMetaAllowed) {
            setAuthorized(true);
            if (pathname === '/login') {
              router.replace('/');
            }
          }

          // Verify with backend role endpoint with strict 2.5s timeout
          try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 2500);
            const res = await fetch('http://localhost:3000/api/admin/my-role', {
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              },
              signal: controller.signal
            });
            clearTimeout(tid);

            if (res.ok) {
              const data = await res.json();
              if (data.role && ALLOWED_ROLES.includes(data.role)) {
                setAuthorized(true);
                if (pathname === '/login') {
                  router.replace('/');
                }
              } else if (data.role && !ALLOWED_ROLES.includes(data.role)) {
                // Role was revoked or not allowed
                supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                setAuthorized(false);
                if (pathname !== '/login') {
                  router.replace('/login');
                }
              }
            } else if (!isMetaAllowed) {
              // Non-OK and metadata not allowed
              supabase.auth.signOut({ scope: 'local' }).catch(() => {});
              setAuthorized(false);
              if (pathname !== '/login') {
                router.replace('/login');
              }
            }
          } catch (netErr) {
            console.warn('Backend role verification note:', netErr.message);
            // If backend is unreachable but metadata is valid, allow access
            if (!isMetaAllowed) {
              setAuthorized(false);
              if (pathname !== '/login') {
                router.replace('/login');
              }
            }
          }
        }
      } catch (err) {
        console.warn('Auth check error:', err);
        if (pathname !== '/login') {
          router.replace('/login');
        }
      } finally {
        isCheckingRef.current = false;
        setLoading(false);
        clearTimeout(fallbackTimer);
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        checkAuth();
      } else if (event === 'SIGNED_OUT') {
        setAuthorized(false);
        if (pathname !== '/login') {
          router.replace('/login');
        }
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [pathname, isLoginRoute]);

  // If on login route, render children immediately (login form)
  if (isLoginRoute) {
    return children;
  }

  // If still checking session on protected routes, show loading state with escape hatch
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh', 
        background: 'var(--bg-primary, #f8fafc)',
        gap: 16
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid #e2e8f0',
          borderTopColor: 'var(--primary, #B87F5C)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}} />
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 14 }}>Verifying access...</p>
        <button 
          onClick={() => {
            supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            router.replace('/login');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary, #B87F5C)',
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
            marginTop: 4
          }}
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  // If not authorized and not on login, render nothing (redirecting)
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

