import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ── GET All Tables with Categories & Realtime Reservation Status ──
export async function GET(req) {
  try {
    const targetDate = req.nextUrl?.searchParams?.get('date') || getLocalDateString();

    const { data: tables, error: tableErr } = await supabaseAdmin
      .from('restaurant_tables')
      .select('*, table_categories(id, name, description)')
      .order('table_number', { ascending: true });

    if (tableErr) {
      return NextResponse.json({ error: tableErr.message }, { status: 500 });
    }

    // Fetch active reservations for the target date
    const { data: resData, error: resErr } = await supabaseAdmin
      .from('reservations')
      .select('id, table_id, reservation_date, reservation_time, pax, status, special_requests, users(id, full_name, phone_number, email)')
      .eq('reservation_date', targetDate)
      .in('status', ['confirmed', 'pending'])
      .order('reservation_time', { ascending: true });

    if (resErr) {
      console.warn('Could not fetch active reservations in admin tables API:', resErr.message);
    }

    const activeResMap = {};
    if (resData) {
      for (const r of resData) {
        if (!activeResMap[r.table_id]) {
          activeResMap[r.table_id] = r;
        }
      }
    }

    const enriched = (tables || []).map(t => {
      const activeRes = activeResMap[t.id] || null;
      const isBooked = !!activeRes || t.status === 'reserved';
      const displayStatus = (t.status === 'available' && isBooked) ? 'booked' : (t.status === 'reserved' ? 'booked' : t.status);
      return {
        ...t,
        current_reservation: activeRes,
        is_booked: isBooked,
        display_status: displayStatus,
      };
    });

    return NextResponse.json(enriched, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// ── POST: Create Table ──
export async function POST(req) {
  try {
    const body = await req.json();
    const { table_number, name, capacity = 4, category_id, status = 'available' } = body;

    if (!table_number) {
      return NextResponse.json({ error: 'Table number is required' }, { status: 400 });
    }

    const { data: newTable, error } = await supabaseAdmin
      .from('restaurant_tables')
      .insert({
        table_number: parseInt(table_number, 10),
        name: name ? name.trim() : `Table ${table_number}`,
        capacity: parseInt(capacity, 10) || 4,
        category_id: category_id ? parseInt(category_id, 10) : null,
        status: status || 'available'
      })
      .select('*, table_categories(id, name)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Table created successfully', table: newTable }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
