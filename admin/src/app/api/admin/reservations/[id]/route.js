import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

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
      await supabaseAdmin
        .from('restaurant_tables')
        .update({ status: 'available' })
        .eq('id', existing.table_id)
        .eq('status', 'reserved')
        .catch(() => {});
    }

    return NextResponse.json({ message: 'Reservation updated successfully', reservation: updated });
  } catch (error) {
    console.error('API Error updating reservation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
