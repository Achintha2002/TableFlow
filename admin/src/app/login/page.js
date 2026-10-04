"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { AlertCircle, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Proactively ensure superadmin account is ready in Supabase
    fetch('/api/setup-super', { method: 'POST' }).catch(() => {});
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const cleanEmail = email.trim();
      let { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      // If super admin login failed, attempt explicit auto-provision and retry
      if (error && cleanEmail.toLowerCase() === 'superadmin@tableflow.com') {
        try {
          const setupRes = await fetch('/api/setup-super', { method: 'POST' });
          if (setupRes.ok) {
            const retry = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: password,
            });
            data = retry.data;
            error = retry.error;
          }
        } catch (_) {}
      }

      if (error) {
        const isInvalid = error.message?.toLowerCase().includes('invalid') || 
                          error.message?.toLowerCase().includes('credential') ||
                          error.status === 400;
        const msg = isInvalid
          ? 'Invalid login credentials. Please check your email and password.'
          : (error.message || 'Invalid login credentials.');
        setErrorMsg(msg);
        setLoading(false);
        return;
      }

      window.location.href = '/';
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Invalid login credentials. Please check your email and password.');
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #f8fafc)' }}>
      <div className="full-data-card" style={{ width: 420, padding: '36px 32px', background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary)', fontSize: 28, margin: 0, fontWeight: 700 }}>TableFlow</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4, fontWeight: 600 }}>Admin Console</p>
        </div>

        {errorMsg && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '12px 14px',
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            lineHeight: 1.4
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, color: '#ef4444' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={e => {
                  setEmail(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }} 
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 36px',
                  background: 'var(--bg-surface, #ffffff)',
                  border: `1px solid ${errorMsg ? '#ef4444' : 'var(--border, #cbd5e1)'}`,
                  color: 'var(--text-primary)',
                  borderRadius: 8,
                  outline: 'none',
                  fontSize: 14,
                  transition: 'border-color 0.15s ease'
                }} 
                placeholder="admin@tableflow.com"
              />
              <Mail size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={e => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }} 
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 36px',
                  background: 'var(--bg-surface, #ffffff)',
                  border: `1px solid ${errorMsg ? '#ef4444' : 'var(--border, #cbd5e1)'}`,
                  color: 'var(--text-primary)',
                  borderRadius: 8,
                  outline: 'none',
                  fontSize: 14,
                  transition: 'border-color 0.15s ease'
                }} 
                placeholder="••••••••"
              />
              <Lock size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', marginTop: 6, fontSize: 14, fontWeight: 700, justifyContent: 'center', borderRadius: 8 }}
          >
            {loading ? 'Verifying credentials...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
