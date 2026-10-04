"use client";
import { useEffect, useState } from 'react';
import { supabase, getSafeSession } from '../../lib/supabase';
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

  const isSuperAdmin = currentUser?.role === 'super_admin' || 
                       currentUser?.email?.toLowerCase() === 'superadmin@tableflow.com' ||
                       currentUser?.email?.toLowerCase().includes('superadmin');

  useEffect(() => {
    loadCurrentProfile();
    loadUsers();
  }, []);

  async function loadCurrentProfile() {
    try {
      const session = await getSafeSession(1500);
      if (session?.user) {
        const isSA = session.user.email?.toLowerCase() === 'superadmin@tableflow.com' || 
                     session.user.email?.toLowerCase().includes('superadmin') || 
                     session.user.user_metadata?.role === 'super_admin';
        
        // Immediate state setup so super admin controls unlock instantly
        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          role: isSA ? 'super_admin' : (session.user.user_metadata?.role || 'admin'),
          full_name: session.user.user_metadata?.full_name || 'Admin'
        });

        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 2500);
          const res = await fetch('http://localhost:3000/api/admin/my-role', {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            signal: controller.signal
          });
          clearTimeout(tid);
          if (res.ok) {
            const data = await res.json();
            if (isSA) data.role = 'super_admin';
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
      const res = await fetch('http://localhost:3000/api/admin/users');
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

    if (targetRole === 'super_admin') {
      alert("Super Admin accounts cannot be modified.");
      return;
    }

    if (targetRole === 'admin' && !isSuperAdmin) {
      alert("Only a Super Admin can change the role of an Admin account.");
      return;
    }

    if (newRole === 'super_admin' && !isSuperAdmin) {
      alert("Only an existing Super Admin can assign the Super Admin role.");
      return;
    }

    try {
      const session = await getSafeSession(1500);
      const res = await fetch('http://localhost:3000/api/admin/update-role', {
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

  async function handleAddStaff(e) {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/admin/create-staff', {
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

    if (userRole === 'super_admin') {
      alert("Super Admin accounts cannot be deleted.");
      return;
    }

    if (userRole === 'admin' && !isSuperAdmin) {
      alert("Admin accounts can only be deleted by a Super Admin.");
      return;
    }

    const confirmMsg = userRole === 'admin'
      ? `⚠️ SUPER ADMIN ACTION:\nAre you sure you want to permanently delete Admin: ${userName || 'Unknown'}?\nAll administrator privileges will be revoked immediately.`
      : `Are you sure you want to permanently delete user: ${userName || 'Unknown'}? This action cannot be undone.`;

    if (!confirm(confirmMsg)) {
      return;
    }
    
    try {
      const session = await getSafeSession(1500);
      const res = await fetch(`http://localhost:3000/api/admin/users/${userId}`, {
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

  const admins = users.filter(u => u.role === 'super_admin' || u.role === 'admin' || u.role === 'manager');
  admins.sort((a, b) => {
    if (a.role === 'super_admin') return -1;
    if (b.role === 'super_admin') return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    return 0;
  });

  return (
    <>
      <div className="page-content">
        {isSuperAdmin && (
          <div style={{
            marginBottom: 20,
            padding: '12px 20px',
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.18), rgba(245, 158, 11, 0.08))',
            border: '1px solid rgba(212, 175, 55, 0.45)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#d4af37',
            fontSize: 13,
            fontWeight: 600
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              👑 <strong>Super Admin Mode Active:</strong> You can manage, change roles, and delete all Admin & Staff accounts.
            </span>
            <span style={{ fontSize: 11, background: 'rgba(212, 175, 55, 0.25)', padding: '2px 8px', borderRadius: 4, color: '#f59e0b' }}>
              Full Master Control
            </span>
          </div>
        )}

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
                  {isSuperAdmin && <option value="super_admin">👑 Super Admin</option>}
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
                {admins.length > 0 ? admins.map(a => {
                  const isSA = a.role === 'super_admin';
                  return (
                    <div 
                      key={a.id} 
                      className="stat-card" 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 16, 
                        padding: 20,
                        border: isSA ? '1px solid rgba(212, 175, 55, 0.4)' : '1px solid var(--border)',
                        background: isSA ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), var(--bg-card))' : 'var(--bg-card)'
                      }}
                    >
                      <div style={{ 
                        width: 48, 
                        height: 48, 
                        background: isSA ? 'linear-gradient(135deg, #d4af37, #f59e0b)' : 'var(--primary)', 
                        color: 'white', 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: isSA ? 22 : 20, 
                        fontWeight: 'bold',
                        boxShadow: isSA ? '0 0 12px rgba(212, 175, 55, 0.4)' : 'none'
                      }}>
                        {isSA ? '👑' : (a.full_name || 'S')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {a.full_name || 'Staff'}
                        </h4>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {a.email}
                        </p>
                      </div>
                      {isSA ? (
                        <span style={{
                          background: 'rgba(212, 175, 55, 0.18)',
                          color: '#d4af37',
                          border: '1px solid rgba(212, 175, 55, 0.4)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontWeight: '800',
                          fontSize: '10.5px',
                          whiteSpace: 'nowrap'
                        }}>
                          👑 SUPER ADMIN
                        </span>
                      ) : (
                        badge(a.role === 'admin' ? 'success' : 'primary', a.role.charAt(0).toUpperCase() + a.role.slice(1))
                      )}
                    </div>
                  );
                }) : (
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
                    {users.length > 0 ? users.map(u => {
                      const isTargetSA = u.role === 'super_admin' || u.email?.toLowerCase() === 'superadmin@tableflow.com';
                      const isTargetAdmin = u.role === 'admin';
                      const isSelf = u.id === currentUser?.id || (currentUser?.email && u.email?.toLowerCase() === currentUser.email.toLowerCase());
                      const canEditRole = !isSelf && !isTargetSA && (isSuperAdmin || !isTargetAdmin);

                      return (
                        <tr key={u.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {isTargetSA && <span style={{ marginRight: 6 }}>👑</span>}
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
                              {isSuperAdmin && <option value="super_admin">👑 Super Admin</option>}
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
                            ) : isTargetSA ? (
                              <span 
                                style={{ 
                                  padding: '4px 10px', 
                                  fontSize: 11, 
                                  background: 'rgba(212, 175, 55, 0.15)', 
                                  color: '#d4af37', 
                                  border: '1px solid rgba(212, 175, 55, 0.35)', 
                                  borderRadius: 4, 
                                  fontWeight: 700 
                                }}
                              >
                                👑 Super Admin
                              </span>
                            ) : isTargetAdmin ? (
                              isSuperAdmin ? (
                                <button 
                                  className="btn" 
                                  onClick={() => handleDeleteUser(u.id, u.full_name || u.email, u.role)}
                                  style={{ 
                                    padding: '4px 12px', 
                                    fontSize: 12, 
                                    background: 'rgba(239, 68, 68, 0.15)', 
                                    color: '#ef4444', 
                                    border: '1px solid rgba(239, 68, 68, 0.35)', 
                                    borderRadius: 4, 
                                    fontWeight: 600,
                                    cursor: 'pointer' 
                                  }}
                                  title="Super Admin: Delete this admin account"
                                >
                                  Delete Admin
                                </button>
                              ) : (
                                <span 
                                  style={{ 
                                    padding: '4px 10px', 
                                    fontSize: 11, 
                                    background: 'rgba(16, 185, 129, 0.1)', 
                                    color: '#10b981', 
                                    border: '1px solid rgba(16, 185, 129, 0.25)', 
                                    borderRadius: 4, 
                                    fontWeight: 600, 
                                    letterSpacing: 0.3 
                                  }}
                                >
                                  🛡️ Protected
                                </span>
                              )
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
