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
      .order('created_at', { ascending: true });
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

  async function seatQueue(id) {
    await supabase.from('queue_entries').update({ status: 'seated' }).eq('id', id);
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
              <td>👥 {q.party_size} people</td>
              <td>{badge(q.status === 'seated' ? 'success' : q.status === 'waiting' ? 'warning' : 'muted', q.status)}</td>
              <td>{fmtTime(q.created_at)}</td>
              <td>
                {q.status === 'waiting' && (
                  <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => seatQueue(q.id)}>
                    Seat Now
                  </button>
                )}
              </td>
            </tr>
          )) : <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>Queue is empty</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
