"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

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

export default function QueuePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchQueue() {
    const { data: qData } = await supabase
      .from('queue_entries')
      .select('*')
      .order('joined_at', { ascending: true });
    setData(qData || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchQueue();
    const channel = supabase.channel('admin_queue').on('postgres_changes', 
      { event: '*', schema: 'public', table: 'queue_entries' }, 
      () => { fetchQueue(); }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function updateStatus(id, newStatus) {
    await supabase.from('queue_entries').update({ status: newStatus }).eq('id', id);
    fetchQueue();
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading...</p>;

  return (
    <div className="full-data-card">
      <div className="data-card-header">
        <h3>All Queue Entries ({data.length})</h3>
      </div>
      <table className="data-table">
        <thead><tr><th>#</th><th>Entry ID</th><th>Party Size</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          {data.length > 0 ? data.map((q, i) => (
            <tr key={q.id}>
              <td style={{ color: 'var(--text-muted)' }}>{i+1}</td>
              <td style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>#{q.id.slice(0,8)}</td>
              <td>👥 {q.pax} people</td>
              <td>{badge(q.status === 'seated' ? 'success' : q.status === 'waiting' ? 'warning' : 'muted', q.status)}</td>
              <td>{fmtTime(q.joined_at)}</td>
              <td>
                <select 
                  className="status-dropdown" 
                  value={q.status}
                  onChange={(e) => updateStatus(q.id, e.target.value)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-light)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="waiting" style={{ color: '#000' }}>Waiting</option>
                  <option value="notified" style={{ color: '#000' }}>Notified</option>
                  <option value="seated" style={{ color: '#000' }}>Seated</option>
                  <option value="no_show" style={{ color: '#000' }}>No Show</option>
                  <option value="cancelled" style={{ color: '#000' }}>Cancelled</option>
                </select>
              </td>
            </tr>
          )) : <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>Queue is empty</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
