"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

function fmtTimeOnly(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });
}

export default function KDS() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchOrders() {
    // In KDS, we only care about pending, preparing, and ready. Served are gone.
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(quantity, unit_price, menu_items(name))')
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true });
    
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();

    const channel = supabase.channel('kds-orders-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function updateStatus(id, newStatus) {
    await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    fetchOrders();
  }

  if (loading) return <h2 style={{ color: 'var(--text-muted)' }}>Loading Kitchen Display...</h2>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
      {orders.map(o => {
        let borderColor = 'var(--border-color)';
        if (o.status === 'pending') borderColor = 'var(--primary-gold)';
        if (o.status === 'preparing') borderColor = 'var(--info-blue)';
        if (o.status === 'ready') borderColor = 'var(--success-green)';

        return (
          <div key={o.id} style={{ 
            background: 'var(--bg-card)', 
            border: `2px solid ${borderColor}`, 
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: 0, fontFamily: 'monospace', color: 'var(--text-light)' }}>#{o.id.slice(0,6)}</h2>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{fmtTimeOnly(o.created_at)}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px 0' }}>
                {o.order_items && o.order_items.map((item, idx) => (
                  <li key={idx} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '8px 0', 
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '16px',
                    fontWeight: 500
                  }}>
                    <span>{item.quantity}x {item.menu_items?.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => updateStatus(o.id, 'preparing')}
                style={{ 
                  flex: 1, padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                  background: o.status === 'preparing' ? 'var(--info-blue)' : 'rgba(0,0,0,0.05)',
                  color: o.status === 'preparing' ? '#000' : 'var(--text-light)'
                }}>PREP</button>
              <button 
                onClick={() => updateStatus(o.id, 'ready')}
                style={{ 
                  flex: 1, padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                  background: o.status === 'ready' ? 'var(--success-green)' : 'rgba(0,0,0,0.05)',
                  color: o.status === 'ready' ? '#000' : 'var(--text-light)'
                }}>READY</button>
              <button 
                onClick={() => updateStatus(o.id, 'served')}
                style={{ 
                  flex: 1, padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                  background: 'rgba(0,0,0,0.05)', color: 'var(--text-light)'
                }}>SERVE</button>
            </div>
          </div>
        );
      })}
      {orders.length === 0 && (
        <h2 style={{ color: 'var(--text-muted)' }}>No active orders. Kitchen is clear!</h2>
      )}
    </div>
  );
}
