"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

function badge(type, text) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchTables() {
    const { data } = await supabase
      .from('restaurant_tables')
      .select('*')
      .order('table_number', { ascending: true });
    setTables(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchTables();
    const channel = supabase.channel('admin_tables').on('postgres_changes', 
      { event: '*', schema: 'public', table: 'restaurant_tables' }, 
      () => { fetchTables(); }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function updateStatus(id, newStatus) {
    await supabase.from('restaurant_tables').update({ status: newStatus }).eq('id', id);
    fetchTables();
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading tables...</p>;

  return (
    <div className="full-data-card">
      <div className="data-card-header">
        <h3>Tables & Floor Plan</h3>
      </div>
      <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {tables.map(t => (
          <div key={t.id} style={{ 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            padding: '16px',
            background: t.status === 'occupied' ? 'rgba(184, 127, 92, 0.05)' : 'var(--bg-secondary)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>Table {t.table_number}</h4>
              {badge(t.status === 'available' ? 'success' : t.status === 'occupied' ? 'warning' : 'muted', t.status)}
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)' }}>Capacity: {t.capacity} people</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {t.status === 'available' && <button className="btn btn-ghost" style={{ flex: 1, padding: '4px', fontSize: '12px' }} onClick={() => updateStatus(t.id, 'occupied')}>Occupy</button>}
              {t.status === 'occupied' && <button className="btn btn-ghost" style={{ flex: 1, padding: '4px', fontSize: '12px' }} onClick={() => updateStatus(t.id, 'cleaning')}>Clean</button>}
              {t.status === 'cleaning' && <button className="btn btn-primary" style={{ flex: 1, padding: '4px', fontSize: '12px' }} onClick={() => updateStatus(t.id, 'available')}>Ready</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
