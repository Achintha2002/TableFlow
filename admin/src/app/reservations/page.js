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

  async function handleReply(id, currentReply) {
    const reply = window.prompt("Enter reply for the user:", currentReply || "");
    if (reply !== null) {
      await supabase.from('reservations').update({ admin_reply: reply }).eq('id', id);
      fetchReservations();
    }
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
            <th>Special Requests</th>
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
              <td>
                {r.special_requests ? (
                  <div style={{ fontSize: '12px', maxWidth: '150px' }}>
                    <i>"{r.special_requests}"</i>
                  </div>
                ) : <span style={{ color: 'var(--text-muted)' }}>None</span>}
                {r.admin_reply && (
                  <div style={{ fontSize: '12px', color: 'var(--primary-color)', marginTop: '4px' }}>
                    <b>Reply:</b> {r.admin_reply}
                  </div>
                )}
              </td>
              <td>{badge(r.status === 'confirmed' ? 'success' : r.status === 'pending' ? 'warning' : 'muted', r.status)}</td>
              <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select 
                  className="status-dropdown" 
                  value={r.status}
                  onChange={(e) => updateStatus(r.id, e.target.value)}
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
                  <option value="pending" style={{ color: '#000' }}>Pending</option>
                  <option value="confirmed" style={{ color: '#000' }}>Confirmed</option>
                  <option value="cancelled" style={{ color: '#000' }}>Cancelled</option>
                  <option value="completed" style={{ color: '#000' }}>Completed</option>
                </select>
                <button 
                  onClick={() => handleReply(r.id, r.admin_reply)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: 'var(--card-bg-light)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    borderRadius: '4px'
                  }}
                >
                  Reply
                </button>
              </td>
            </tr>
          )) : <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No reservations found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
