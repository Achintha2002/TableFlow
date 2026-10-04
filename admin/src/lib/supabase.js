import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://azjjndqecpemltvdbkvy.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ampuZHFlY3BlbWx0dmRia3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTA3ODEsImV4cCI6MjEwMjM2Njc4MX0.grBF4XJu0696MnrvKC-ZccppLGxPEM9KIHED8viZELc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

/**
 * Safely retrieve session without hanging indefinitely if navigator.locks or Web Locks deadlocks.
 */
export async function getSafeSession(timeoutMs = 1500) {
  try {
    const sessionPromise = supabase.auth.getSession().then(({ data }) => data?.session || null).catch(() => null);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), timeoutMs));
    const session = await Promise.race([sessionPromise, timeoutPromise]);
    if (session) return session;
  } catch (_) {}

  // Fallback: direct localStorage inspection if getSession is deadlocked
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const session = parsed?.currentSession || parsed;
            if (session?.access_token) return session;
          }
        }
      }
    } catch (_) {}
  }

  return null;
}

