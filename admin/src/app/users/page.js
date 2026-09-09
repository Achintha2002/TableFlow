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
  
  // Add Admin Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ full_name: '', email: '', password: '' });
  const [formLoading, setFormLoading] = useState(false);

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

  async function handleSyncUsers() {
    try {
      const res = await fetch('http://localhost:3000/api/admin/sync-users', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        loadUsers();
      } else {
        alert("Sync failed: " + data.error);
      }
    } catch (e) {
      alert("Error syncing users: " + e.message);
    }
  }

  async function handleAddAdmin(e) {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdmin)
      });
      const data = await res.json();
      if (res.ok) {
        alert("Admin created successfully!");
        setShowAddForm(false);
        setNewAdmin({ full_name: '', email: '', password: '' });
        loadUsers();
      } else {
        alert("Failed to create admin: " + data.error);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setFormLoading(false);
  }

  async function handleDeleteUser(userId, userName) {
    if (!confirm(`Are you sure you want to permanently delete user: ${userName || 'Unknown'}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:3000/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (res.ok) {
        alert("User deleted successfully!");
        loadUsers();
      } else {
        alert("Failed to delete user: " + data.error);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  const admins = users.filter(u => u.role === 'admin');

  return (
    <>
      <div className="page-content">
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : '+ Add New Admin'}
          </button>
          <button className="btn btn-secondary" onClick={handleSyncUsers} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            Sync Missing Users
          </button>
        </div>

        {showAddForm && (
          <div className="full-data-card" style={{ marginBottom: 32, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Add New Admin</h3>
            <form onSubmit={handleAddAdmin} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Full Name</label>
                <input required type="text" value={newAdmin.full_name} onChange={e => setNewAdmin({...newAdmin, full_name: e.target.value})} style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Email</label>
                <input required type="email" value={newAdmin.email} onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Password (Min 6 chars)</label>
                <input required type="password" minLength={6} value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }} />
              </div>
              <button disabled={formLoading} type="submit" className="btn btn-primary" style={{ padding: '9px 24px', height: 38 }}>
                {formLoading ? 'Creating...' : 'Create Admin'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        ) : (
          <>
            {/* Admins Section */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ marginBottom: 16, color: 'var(--text-primary)' }}>Admin Profiles ({admins.length})</h3>
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
                    <th>Actions</th>
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
                      <td>
                        <button 
                          className="btn" 
                          onClick={() => handleDeleteUser(u.id, u.full_name || u.email)}
                          style={{ padding: '4px 12px', fontSize: 12, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
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
