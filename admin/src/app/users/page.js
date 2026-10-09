"use client";
import { useEffect, useState } from 'react';
import { supabase, getSafeSession } from '../../lib/supabase';
import { API_BASE } from '../../lib/api';
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
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Add Staff Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState({ full_name: '', email: '', password: '', role: 'cashier' });
  const [formLoading, setFormLoading] = useState(false);

  const isSuperAdmin = false;

  useEffect(() => {
    loadCurrentProfile();
    loadUsers();
  }, []);

  async function loadCurrentProfile() {
    try {
      const session = await getSafeSession(1500);
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          role: session.user.user_metadata?.role || 'admin',
          full_name: session.user.user_metadata?.full_name || 'Admin'
        });

        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(`${API_BASE}/api/admin/my-role`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            signal: controller.signal
          });
          clearTimeout(tid);
          if (res.ok) {
            const data = await res.json();
            setCurrentUser(data);
          }
        } catch (_) {}
      }
    } catch (e) {
      console.error("Failed to load current user profile:", e);
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data || []);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }

  async function updateUserRole(userId, newRole, targetRole) {
    if (userId === currentUser?.id) {
      alert("You cannot change your own role.");
      return;
    }

    try {
      const session = await getSafeSession(1500);
      const res = await fetch(`${API_BASE}/api/admin/update-role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session ? `Bearer ${session.access_token}` : ''
        },
        body: JSON.stringify({ userId, newRole })
      });
      const data = await res.json();
      if (res.ok) {
        loadUsers();
      } else {
        alert("Failed to update user role: " + data.error);
      }
    } catch (error) {
      alert("Error updating user role: " + error.message);
    }
  }

  async function handleSyncUsers() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/sync-users`, { method: 'POST' });
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

  async function handleAddStaff(e) {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/create-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff)
      });
      const data = await res.json();
      if (res.ok) {
        alert("Staff created successfully!");
        setShowAddForm(false);
        setNewStaff({ full_name: '', email: '', password: '', role: 'cashier' });
        loadUsers();
      } else {
        alert("Failed to create staff: " + data.error);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setFormLoading(false);
  }

  async function handleDeleteUser(userId, userName, userRole) {
    if (userId === currentUser?.id) {
      alert("You cannot delete your own account.");
      return;
    }

    const confirmMsg = `Are you sure you want to permanently delete user: ${userName || 'Unknown'}? This action cannot be undone.`;

    if (!confirm(confirmMsg)) {
      return;
    }
    
    try {
      const session = await getSafeSession(1500);
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': session ? `Bearer ${session.access_token}` : ''
        }
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

  const admins = users.filter(u => 
    (u.role === 'admin' || u.role === 'manager') && 
    u.email?.toLowerCase() !== 'superadmin@tableflow.com' && 
    u.role !== 'super_admin'
  );
  admins.sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    return 0;
  });

  return (
    <>
      <div className="page-content">

        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : '+ Add New Staff'}
          </button>
          <button className="btn btn-secondary" onClick={handleSyncUsers} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            Sync Missing Users
          </button>
        </div>

        {showAddForm && (
          <div className="full-data-card" style={{ marginBottom: 32, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Add New Staff</h3>
            <form onSubmit={handleAddStaff} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 150 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Role</label>
                <select value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }}>
                  <option value="cashier">Cashier</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Full Name</label>
                <input required type="text" value={newStaff.full_name} onChange={e => setNewStaff({...newStaff, full_name: e.target.value})} style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Email</label>
                <input required type="email" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Password (Min 6 chars)</label>
                <input required type="password" minLength={6} value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }} />
              </div>
              <button disabled={formLoading} type="submit" className="btn btn-primary" style={{ padding: '9px 24px', height: 38 }}>
                {formLoading ? 'Creating...' : 'Create Staff'}
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
              <h3 style={{ marginBottom: 16, color: 'var(--text-primary)' }}>Admin & Manager Profiles ({admins.length})</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {admins.length > 0 ? admins.map(a => (
                  <div 
                    key={a.id} 
                    className="stat-card" 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 16, 
                      padding: 20,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)'
                    }}
                  >
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      background: 'var(--primary)', 
                      color: 'white', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: 20, 
                      fontWeight: 'bold'
                    }}>
                      {(a.full_name || 'A')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {a.full_name || 'Staff'}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {a.email}
                      </p>
                    </div>
                    {badge(a.role === 'admin' ? 'success' : 'primary', a.role.charAt(0).toUpperCase() + a.role.slice(1))}
                  </div>
                )) : (
                  <p style={{ color: 'var(--text-muted)' }}>No admins or managers found.</p>
                )}
              </div>
            </div>

            {/* All Users Section */}
            <div className="full-data-card">
              <div className="data-card-header">
                <h3>All Registered Users ({users.length})</h3>
              </div>
              <div className="table-responsive">
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
                    {users.length > 0 ? users.filter(u => u.email?.toLowerCase() !== 'superadmin@tableflow.com' && u.role !== 'super_admin').map(u => {
                      const isSelf = u.id === currentUser?.id || (currentUser?.email && u.email?.toLowerCase() === currentUser.email.toLowerCase());
                      const canEditRole = !isSelf;

                      return (
                        <tr key={u.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {u.full_name || '—'}
                          </td>
                          <td>{u.email}</td>
                          <td>{u.phone_number || '—'}</td>
                          <td>{fmtTime(u.created_at)}</td>
                          <td>
                            <select 
                              className="role-select" 
                              value={u.role || 'customer'}
                              disabled={!canEditRole}
                              onChange={(e) => updateUserRole(u.id, e.target.value, u.role)}
                              style={{ 
                                padding: '4px 8px', 
                                borderRadius: 4, 
                                border: '1px solid var(--border)', 
                                background: canEditRole ? 'var(--bg-surface)' : 'rgba(0,0,0,0.04)', 
                                color: 'var(--text-primary)',
                                cursor: canEditRole ? 'pointer' : 'not-allowed',
                                opacity: canEditRole ? 1 : 0.8
                              }}
                            >
                              <option value="customer">Customer</option>
                              <option value="cashier">Cashier</option>
                              <option value="kitchen">Kitchen</option>
                              <option value="manager">Manager</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td>
                            {isSelf ? (
                              <span 
                                style={{ 
                                  padding: '4px 10px', 
                                  fontSize: 11, 
                                  background: 'rgba(59, 130, 246, 0.12)', 
                                  color: '#3b82f6', 
                                  borderRadius: 4, 
                                  fontWeight: 600 
                                }}
                              >
                                You (Active)
                              </span>
                            ) : (
                              <button 
                                className="btn" 
                                onClick={() => handleDeleteUser(u.id, u.full_name || u.email, u.role)}
                                style={{ padding: '4px 12px', fontSize: 12, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer' }}
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
