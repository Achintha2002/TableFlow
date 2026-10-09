import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

// ── GET Single Reservation ──
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { data: res, error } = await supabaseAdmin
      .from('reservations')
      .select('*, restaurant_tables(id, table_number, capacity), users(id, full_name, phone_number, email)')
      .eq('id', id)
      .maybeSingle();

    if (error || !res) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── PUT: Full Update (CRUD Edit) ──
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      customer_name,
      phone_number,
      email,
      reservation_date,
      reservation_time,
      pax,
      table_id,
      special_requests,
      status
    } = body;

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('reservations')
      .select('*, users(*)')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !existing) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Validation: prevent updating to past dates or past time today
    if (reservation_date) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (reservation_date < todayStr) {
        return NextResponse.json({ error: 'Cannot update reservation to a past date. Please pick today or a future date.' }, { status: 400 });
      }
      if (reservation_date === todayStr && reservation_time) {
        const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (reservation_time < nowTimeStr) {
          return NextResponse.json({ error: 'Cannot update reservation to a past time today. Please pick an upcoming time.' }, { status: 400 });
        }
      }
    }

    // 1. Update user profile if customer_name, phone, or email is provided
    if (existing.user_id && (customer_name || phone_number !== undefined || email !== undefined)) {
      const userUpdates = {};
      if (customer_name) userUpdates.full_name = customer_name.trim();
      if (phone_number !== undefined) userUpdates.phone_number = phone_number ? phone_number.trim() : null;
      if (email !== undefined) userUpdates.email = email ? email.trim().toLowerCase() : null;

      if (Object.keys(userUpdates).length > 0) {
        try {
          await supabaseAdmin.from('users').update(userUpdates).eq('id', existing.user_id);
        } catch (_) {}
      }
    }

    // 2. Prepare reservation updates
    const updates = {};
    if (reservation_date) updates.reservation_date = reservation_date;
    if (reservation_time) {
      updates.reservation_time = reservation_time.length === 5 ? `${reservation_time}:00` : reservation_time;
    }
    if (pax !== undefined) updates.pax = parseInt(pax, 10) || existing.pax || 2;
    if (table_id !== undefined) {
      updates.table_id = table_id && table_id !== 'none' ? parseInt(table_id, 10) : null;
    }
    if (special_requests !== undefined) updates.special_requests = special_requests ? special_requests.trim() : null;
    if (status) updates.status = status;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('reservations')
      .update(updates)
      .eq('id', id)
      .select('*, restaurant_tables(table_number, capacity), users(full_name, phone_number, email)')
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Table state synchronization
    const oldTableId = existing.table_id;
    const newTableId = updates.table_id;

    if (oldTableId && oldTableId !== newTableId) {
      // Release old table
      try {
        await supabaseAdmin
          .from('restaurant_tables')
          .update({ status: 'available' })
          .eq('id', oldTableId);
      } catch (_) {}
    }

    if (newTableId && (status === 'confirmed' || (!status && existing.status === 'confirmed'))) {
      // Reserve new table
      try {
        await supabaseAdmin
          .from('restaurant_tables')
          .update({ status: 'reserved' })
          .eq('id', newTableId);
      } catch (_) {}
    } else if (status === 'cancelled' && newTableId) {
      try {
        await supabaseAdmin
          .from('restaurant_tables')
          .update({ status: 'available' })
          .eq('id', newTableId);
      } catch (_) {}
    }

    return NextResponse.json({ message: 'Reservation updated successfully', reservation: updated });
  } catch (err) {
    console.error('Update reservation PUT error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

// ── DELETE: Delete Reservation (CRUD Delete) ──
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('reservations')
      .select('table_id, status')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !existing) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Delete reservation
    const { error: delErr } = await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('id', id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // Release table if it was reserved
    if (existing.table_id) {
      try {
        await supabaseAdmin
          .from('restaurant_tables')
          .update({ status: 'available' })
          .eq('id', existing.table_id);
      } catch (_) {}
    }

    return NextResponse.json({ message: 'Reservation deleted successfully' });
  } catch (err) {
    console.error('Delete reservation error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

// ── PATCH: Quick Status & Hotline Cancellation ──
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, admin_reply, staff_note, cancel_reason } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !existing) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    const noteToSave = admin_reply || (staff_note ? (cancel_reason ? `[Cancelled: ${cancel_reason}] ${staff_note}` : staff_note) : (cancel_reason ? `[Cancelled via Hotline: ${cancel_reason}]` : null));

    let updatePayload = { status };
    if (noteToSave) {
      updatePayload.admin_reply = noteToSave;
    }

    let { data: updated, error: updateErr } = await supabaseAdmin
      .from('reservations')
      .update(updatePayload)
      .eq('id', id)
      .select('*, restaurant_tables(table_number), users(full_name, phone_number, email)')
      .single();

    // Fallback if admin_reply column is absent in schema
    if (updateErr && (updateErr.message?.includes('admin_reply') || updateErr.code === 'PGRST204')) {
      const fallbackPayload = { status };
      if (noteToSave) {
        fallbackPayload.special_requests = existing.special_requests
          ? `${existing.special_requests} | ${noteToSave}`
          : noteToSave;
      }
      const retry = await supabaseAdmin
        .from('reservations')
        .update(fallbackPayload)
        .eq('id', id)
        .select('*, restaurant_tables(table_number), users(full_name, phone_number, email)')
        .single();
      updated = retry.data;
      updateErr = retry.error;
    }

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Release table if cancelled
    if (status === 'cancelled' && existing.table_id) {
      try {
        await supabaseAdmin
          .from('restaurant_tables')
          .update({ status: 'available' })
          .eq('id', existing.table_id);
      } catch (_) {}
    } else if (status === 'completed' && existing.table_id) {
      try {
        await supabaseAdmin
          .from('restaurant_tables')
          .update({ status: 'occupied' })
          .eq('id', existing.table_id);
      } catch (_) {}
    }

    return NextResponse.json({ message: 'Reservation updated successfully', reservation: updated });
  } catch (error) {
    console.error('API Error updating reservation:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
