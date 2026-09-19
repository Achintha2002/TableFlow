"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Helper to get token
function getToken() {
  // In a real app, you'd get the auth token from supabase session
  return supabase.auth.getSession().then(({ data }) => data.session?.access_token);
}

function Timer({ targetServeTime, reservationId, createdAt }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10000); // update every 10s
    return () => clearInterval(interval);
  }, []);

  if (!targetServeTime) return <span>-</span>;
  
  const target = new Date(targetServeTime);
  const created = new Date(createdAt);
  
  if (reservationId) {
    // PRE-ORDER: COUNTDOWN (target - now)
    const diffMs = target - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    let color = 'var(--success-green)';
    let text = `Ready in ${diffMins} min`;
    
    if (diffMins <= 5) {
      color = 'var(--danger-red)';
      text = diffMins < 0 ? `OVERDUE by ${Math.abs(diffMins)}m` : `Urgent: ${diffMins} min`;
    } else if (diffMins <= 15) {
      color = 'var(--primary-gold)';
    }

    // Flashing effect if < 5 mins
    const isFlashing = diffMins < 5;

    return <div className={isFlashing ? 'flashing-text' : ''} style={{ color, fontWeight: 'bold', fontSize: '18px' }}>{text}</div>;
  } else {
    // DINE-IN NOW: ELAPSED TIME (now - created)
    const elapsedMs = now - created;
    const elapsedMins = Math.floor(elapsedMs / 60000);
    
    let color = 'var(--success-green)';
    let text = `Waiting: ${elapsedMins} min`;
    
    if (elapsedMins >= 20) {
      color = 'var(--danger-red)';
    } else if (elapsedMins >= 10) {
      color = 'var(--primary-gold)';
    }

    return <div style={{ color, fontWeight: 'bold', fontSize: '18px' }}>{text}</div>;
  }
}

export default function KDS() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastChimeTime = useState({ current: 0 })[0];

  function playKitchenChime() {
    if (!soundEnabled) return;
    const now = Date.now();
    // Debounce: prevent chime from firing more than once every 2.5 seconds
    if (now - lastChimeTime.current < 2500) return;
    lastChimeTime.current = now;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      console.warn('Kitchen chime audio notice:', e);
    }
  }

  async function fetchOrders() {
    const token = await getToken();
    const res = await fetch('http://localhost:3000/api/kitchen/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setOrders(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();

    const channel = supabase.channel('kds-orders-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          playKitchenChime();
        }
        fetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [soundEnabled]);

  async function updateStatus(id, newStatus) {
    const token = await getToken();
    await fetch(`http://localhost:3000/api/kitchen/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus })
    });
    fetchOrders();
  }

  if (loading) return <h2 style={{ color: 'var(--text-muted)' }}>Loading Kitchen Display...</h2>;

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  const Column = ({ title, items, color, nextAction, nextStatus }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', minHeight: '80vh' }}>
      <h2 style={{ borderBottom: `2px solid ${color}`, paddingBottom: '12px', color: 'var(--text-light)', marginTop: 0 }}>
        {title} ({items.length})
      </h2>
      {items.map(o => (
        <div key={o.id} style={{ 
          background: 'var(--bg-card)', 
          borderLeft: `6px solid ${color}`, 
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '24px', color: 'var(--text-light)' }}>
                {o.restaurant_tables?.table_number ? `Table ${o.restaurant_tables.table_number}` : 'No Table'}
              </h3>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                {o.users?.full_name || 'Guest'} • #{o.id.slice(0,5).toUpperCase()}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Timer 
                targetServeTime={o.target_serve_time} 
                reservationId={o.reservation_id} 
                createdAt={o.created_at} 
              />
            </div>
          </div>

          {/* Items */}
          <div style={{ flex: 1, marginBottom: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {o.order_items && o.order_items.map((item, idx) => (
                <li key={idx} style={{ padding: '8px 0', borderBottom: idx < o.order_items.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 600, color: 'var(--text-light)' }}>
                    <span><span style={{ color: color }}>{item.quantity}x</span> {item.menu_items?.name}</span>
                  </div>
                  {(item.item_notes || item.special_instructions) && (
                    <div style={{ 
                      marginTop: '6px', 
                      display: 'inline-block',
                      background: 'rgba(184, 127, 92, 0.2)', 
                      color: 'var(--primary-gold)',
                      border: '1px solid rgba(212, 175, 55, 0.4)',
                      padding: '4px 10px', 
                      borderRadius: '6px', 
                      fontSize: '12px',
                      fontWeight: 'bold',
                      lineHeight: 1.3
                    }}>
                      {item.item_notes || item.special_instructions}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Order Notes */}
          {o.special_notes && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255, 193, 7, 0.1)', border: '1px solid var(--primary-gold)', borderRadius: '8px', color: 'var(--primary-gold)', fontSize: '14px' }}>
              <strong>Note:</strong> {o.special_notes}
            </div>
          )}

          {/* Action */}
          {nextAction && (
            <button 
              onClick={() => updateStatus(o.id, nextStatus)}
              style={{ 
                padding: '16px', 
                borderRadius: '8px', 
                border: 'none', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                fontSize: '16px',
                background: color,
                color: '#000',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
              {nextAction}
            </button>
          )}
        </div>
      ))}
      {items.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>Empty</div>
      )}
    </div>
  );

  return (
    <div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flash {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        .flashing-text {
          animation: flash 1s infinite;
        }
      `}} />
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: 'var(--text-light)' }}>Kitchen Display System</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              padding: '8px 14px',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              background: soundEnabled ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: soundEnabled ? 'var(--primary-gold)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {soundEnabled ? '🔔 Sound: ON' : '🔕 Sound: OFF'}
          </button>
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Live Updates Active 🟢</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        <Column 
          title="PENDING" 
          items={pendingOrders} 
          color="var(--primary-gold)" 
          nextAction="Start Preparing"
          nextStatus="preparing"
        />
        <Column 
          title="PREPARING" 
          items={preparingOrders} 
          color="var(--info-blue)" 
          nextAction="Mark as Ready"
          nextStatus="ready"
        />
        <Column 
          title="READY" 
          items={readyOrders} 
          color="var(--success-green)" 
        />
      </div>
    </div>
  );
}
