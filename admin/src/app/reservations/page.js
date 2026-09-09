"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

function badge(type, text) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchReservations() {
    const { data } = await supabase
      .from('reservations')
      .select('*, restaurant_tables(table_number)')
      .order('reservation_date', { ascending: true })
      .order('reservation_time', { ascending: true });
    setReservations(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchReservations();
  }, []);

  async function updateStatus(id, newStatus) {
    await supabase.from('reservations').update({ status: newStatus }).eq('id', id);
    fetchReservations();
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading reservations...</p>;

  return (
    <div className="full-data-card">
      <div className="data-card-header">
        <h3>Upcoming Reservations</h3>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Table</th>
            <th>Pax</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reservations.length > 0 ? reservations.map(r => (
            <tr key={r.id}>
              <td>{r.reservation_date} at {r.reservation_time.slice(0,5)}</td>
              <td>Table {r.restaurant_tables?.table_number ?? 'N/A'}</td>
              <td>{r.pax}</td>
              <td>{badge(r.status === 'confirmed' ? 'success' : r.status === 'pending' ? 'warning' : 'muted', r.status)}</td>
              <td>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {r.status === 'pending' && <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => updateStatus(r.id, 'confirmed')}>Confirm</button>}
                  {(r.status === 'pending' || r.status === 'confirmed') && <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'red' }} onClick={() => updateStatus(r.id, 'cancelled')}>Cancel</button>}
                  {r.status === 'confirmed' && <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => updateStatus(r.id, 'completed')}>Complete</button>}
                </div>
              </td>
            </tr>
          )) : <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No reservations found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
