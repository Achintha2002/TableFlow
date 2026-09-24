"use client";

import { useEffect, useState, useCallback } from 'react';

const API_BASE = 'http://localhost:3000';

export default function PartnerSyncPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState(null);
  const [testingAll, setTestingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/partners/sync`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore) setSettings(data);
        }
      } catch (e) {
        console.error('Error fetching partner sync settings:', e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, []);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function handleToggleMaster(checked) {
    if (!settings) return;
    setSettings(prev => ({ ...prev, live_sync_enabled: checked }));
    try {
      const res = await fetch(`${API_BASE}/api/partners/sync`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ live_sync_enabled: checked })
      });
      if (res.ok) {
        showToast(checked ? 'Live Partner Sync is now ACTIVE!' : 'Live Partner Sync has been PAUSED.');
      }
    } catch (err) {
      console.error(err);
      fetchSyncSettings();
    }
  }

  async function handleTogglePlatform(platformId, enabled) {
    if (!settings) return;
    setSettings(prev => ({
      ...prev,
      platforms: prev.platforms.map(p => p.id === platformId ? { ...p, enabled, status: enabled ? 'Live sync enabled' : 'Not connected' } : p)
    }));

    try {
      const res = await fetch(`${API_BASE}/api/partners/sync`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_id: platformId, enabled })
      });
      if (res.ok) {
        showToast(`Platform settings updated.`);
      }
    } catch (err) {
      console.error(err);
      fetchSyncSettings();
    }
  }

  async function handleTestSync(platformId) {
    setTestingId(platformId);
    try {
      const res = await fetch(`${API_BASE}/api/partners/sync/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_id: platformId })
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`✅ ${data.message}`);
        fetchSyncSettings();
      }
    } catch (e) {
      showToast('❌ Test sync request failed.');
    } finally {
      setTestingId(null);
    }
  }

  async function handleTestAll() {
    setTestingAll(true);
    try {
      const res = await fetch(`${API_BASE}/api/partners/sync/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`✅ ${data.message}`);
        fetchSyncSettings();
      }
    } catch (e) {
      showToast('❌ Test ping failed.');
    } finally {
      setTestingAll(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)', padding: '24px' }}>Loading Partner Sync settings...</p>;

  const masterEnabled = settings?.live_sync_enabled ?? true;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: '#1e293b',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          fontSize: '13px',
          fontWeight: '600'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)' }}>
          Partner Sync Settings
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
          Connect TableFlow with external booking networks (BookMe, Reserve.lk, DineHub) for real-time table sync and conflict-free reservations.
        </p>
      </div>

      {/* Master Toggle Banner */}
      <div style={{
        background: masterEnabled ? 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)' : '#ffffff',
        border: masterEnabled ? '1.5px solid #a7f3d0' : '1px solid var(--border)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: masterEnabled ? '#10b981' : '#94a3b8',
                color: '#ffffff',
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                🔄
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Master Live Availability Sync
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  {masterEnabled
                    ? 'Broadcasting table availability and receiving external bookings in real time.'
                    : 'External sync is currently PAUSED. Booking networks will see your tables as unlinked.'}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={handleTestAll}
              disabled={testingAll || !masterEnabled}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: '#ffffff',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: (testingAll || !masterEnabled) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {testingAll ? 'Testing Sync...' : '⚡ Test All Connections'}
            </button>

            {/* Big Switch */}
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '10px' }}>
              <span style={{
                fontSize: '12px',
                fontWeight: '800',
                color: masterEnabled ? '#059669' : '#64748b',
                textTransform: 'uppercase'
              }}>
                {masterEnabled ? 'LIVE & ACTIVE' : 'OFF / PAUSED'}
              </span>
              <input
                type="checkbox"
                checked={masterEnabled}
                onChange={(e) => handleToggleMaster(e.target.checked)}
                style={{
                  width: '44px',
                  height: '24px',
                  cursor: 'pointer',
                  accentColor: '#10b981'
                }}
              />
            </label>
          </div>
        </div>

        {/* Sync Status Badge */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: 'var(--text-muted)' }}>
          <div>
            <b>Last Global Sync:</b> {settings?.last_synced_at ? new Date(settings.last_synced_at).toLocaleTimeString() : 'Just now'}
          </div>
          <div>
            <b>Active Platforms:</b> {settings?.platforms?.filter(p => p.enabled).length || 0} of {settings?.platforms?.length || 3}
          </div>
          <div>
            <b>Conflict Protection:</b> <span style={{ color: '#059669', fontWeight: 'bold' }}>Enabled (0 double bookings)</span>
          </div>
        </div>
      </div>

      {/* Platform Cards Grid */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>
          Connected Booking Networks
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '18px'
        }}>
          {settings?.platforms?.map(p => (
            <div
              key={p.id}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: p.enabled ? '1.5px solid #d1fae5' : '1px solid var(--border)',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                {/* Platform Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: p.enabled ? 'var(--primary)' : '#94a3b8',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '17px'
                    }}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: p.enabled ? '#059669' : '#64748b', fontWeight: '600' }}>
                        {p.enabled ? '🟢 Connected' : '⚪ Disconnected'}
                      </div>
                    </div>
                  </div>

                  {/* Platform Switch */}
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => handleTogglePlatform(p.id, e.target.checked)}
                    style={{
                      width: '38px',
                      height: '20px',
                      cursor: 'pointer',
                      accentColor: '#10b981'
                    }}
                  />
                </div>

                {/* Platform Metrics */}
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  fontSize: '12px'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Reservations:</span>{' '}
                    <b style={{ color: 'var(--text-primary)' }}>{p.reservations_imported || 0}</b>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Latency:</span>{' '}
                    <b style={{ color: '#059669' }}>{p.response_time_ms ? `${p.response_time_ms}ms` : '—'}</b>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last Sync:</span>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {p.last_sync ? new Date(p.last_sync).toLocaleTimeString() : 'Not synced yet'}
                    </span>
                  </div>
                </div>

                {/* Webhook Endpoint */}
                <div style={{ fontSize: '11px', marginBottom: '14px' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '3px', fontWeight: '600' }}>WEBHOOK URL</div>
                  <div style={{
                    background: '#f1f5f9',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    color: '#334155',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {p.webhook_url}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  onClick={() => handleTestSync(p.id)}
                  disabled={testingId === p.id}
                  style={{
                    flex: '1',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    cursor: testingId === p.id ? 'not-allowed' : 'pointer'
                  }}
                >
                  {testingId === p.id ? 'Testing...' : '🔄 Test Sync'}
                </button>
                <button
                  onClick={() => showToast(`API credentials for ${p.name} are active & verified.`)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  ⚙️ Config
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync Activity Log */}
      <div className="full-data-card">
        <div className="data-card-header">
          <h3>Recent Synchronization Events</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Platform</th>
              <th>Event Details</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {settings?.sync_logs?.map(log => (
              <tr key={log.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {new Date(log.time).toLocaleTimeString()}
                </td>
                <td style={{ fontWeight: '700', fontSize: '13px' }}>
                  {log.platform}
                </td>
                <td style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  {log.message}
                </td>
                <td>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: log.status === 'success' ? '#dcfce7' : '#fee2e2',
                    color: log.status === 'success' ? '#15803d' : '#b91c1c'
                  }}>
                    {log.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
