"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Topbar from '../../components/Topbar';

function badge(type, text) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  async function updateUserRole(userId, newRole) {
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
    if (error) {
      alert("Failed to update user role. Make sure you ran the SQL command to allow Admins to update users! Error: " + error.message);
    } else {
      loadUsers();
    }
  }

  const admins = users.filter(u => u.role === 'admin');

  return (
    <>
      <Topbar title="Users & Admins" subtitle="Manage registered users and assign admin roles" />
      
      <div className="page-content">
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        ) : (
          <>
            {/* Admins Section */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ marginBottom: 16, color: 'var(--text-primary)' }}>Admin Profiles</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {admins.length > 0 ? admins.map(a => (
                  <div key={a.id} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20 }}>
                    <div style={{ width: 48, height: 48, background: 'var(--primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 'bold' }}>
                      {(a.full_name || 'A')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {a.full_name || 'Admin'}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {a.email}
                      </p>
                    </div>
                    {badge('success', 'Admin')}
                  </div>
                )) : (
                  <p style={{ color: 'var(--text-muted)' }}>No admins found.</p>
                )}
              </div>
            </div>

            {/* All Users Section */}
            <div className="full-data-card">
              <div className="data-card-header">
                <h3>All Registered Users ({users.length})</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Joined</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length > 0 ? users.map(u => (
                    <tr key={u.id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.full_name || '—'}</td>
                      <td>{u.email}</td>
                      <td>{u.phone_number || '—'}</td>
                      <td>{fmtTime(u.created_at)}</td>
                      <td>
                        <select 
                          className="role-select" 
                          value={u.role || 'customer'}
                          onChange={(e) => updateUserRole(u.id, e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                        >
                          <option value="customer">Customer</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
