import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

// ── PATCH: Update Table Status ──
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('restaurant_tables')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If table is made available, also cancel active reservations for this table
    if (status === 'available') {
      await supabaseAdmin
        .from('reservations')
        .update({
          status: 'cancelled',
          admin_reply: '[Cancelled by Staff via Floor Plan]'
        })
        .eq('table_id', id)
        .in('status', ['confirmed', 'pending'])
        .catch(() => {});
    } else if (status === 'occupied') {
      // If table is marked occupied (guests seated), complete the reservation
      await supabaseAdmin
        .from('reservations')
        .update({
          status: 'completed',
          admin_reply: '[Guests seated at table]'
        })
        .eq('table_id', id)
        .in('status', ['confirmed', 'pending'])
        .catch(() => {});
    }

    return NextResponse.json({ message: 'Table status updated', table: updated });
  } catch (err) {
    console.error('Error in PATCH /api/admin/tables/[id]:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

// ── PUT: Full Table Edit (CRUD Edit) ──
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { table_number, capacity, category_id, status } = body;

    const updates = {};
    if (table_number !== undefined) updates.table_number = parseInt(table_number, 10);
    if (capacity !== undefined) updates.capacity = parseInt(capacity, 10);
    if (category_id !== undefined) updates.category_id = category_id ? parseInt(category_id, 10) : null;
    if (status !== undefined) updates.status = status;

    const { data: updated, error } = await supabaseAdmin
      .from('restaurant_tables')
      .update(updates)
      .eq('id', id)
      .select('*, table_categories(id, name)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Table updated successfully', table: updated });
  } catch (err) {
    console.error('Error in PUT /api/admin/tables/[id]:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

// ── DELETE: Delete Table ──
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;

    // Unlink active reservations
    await supabaseAdmin
      .from('reservations')
      .update({ table_id: null })
      .eq('table_id', id)
      .catch(() => {});

    const { error } = await supabaseAdmin
      .from('restaurant_tables')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Table deleted successfully' });
  } catch (err) {
    console.error('Error in DELETE /api/admin/tables/[id]:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
