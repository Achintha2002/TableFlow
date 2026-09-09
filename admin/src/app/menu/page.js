"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

function badge(type, text) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchMenu() {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchMenu();
  }, []);

  async function toggleAvailability(id, current) {
    await supabase.from('menu_items').update({ is_available: !current }).eq('id', id);
    fetchMenu();
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading menu...</p>;

  return (
    <div className="full-data-card">
      <div className="data-card-header">
        <h3>Restaurant Menu</h3>
        <button className="btn btn-primary">+ Add Item</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Price</th>
            <th>Availability</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(m => (
            <tr key={m.id}>
              <td>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
              </td>
              <td>{m.category}</td>
              <td>${(m.price ?? 0).toFixed(2)}</td>
              <td>{badge(m.is_available ? 'success' : 'muted', m.is_available ? 'Available' : 'Sold Out')}</td>
              <td>
                <button 
                  className="btn btn-ghost" 
                  style={{ padding: '4px 8px', fontSize: '12px' }} 
                  onClick={() => toggleAvailability(m.id, m.is_available)}
                >
                  {m.is_available ? 'Mark Sold Out' : 'Mark Available'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
