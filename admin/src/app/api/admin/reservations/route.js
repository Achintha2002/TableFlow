import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('*, restaurant_tables(table_number, capacity), users(id, full_name, phone_number, email)')
      .order('reservation_date', { ascending: false })
      .order('reservation_time', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Fetch reservations error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      customer_name,
      phone_number,
      email,
      reservation_date,
      reservation_time,
      pax = 2,
      table_id,
      special_requests,
      status = 'confirmed'
    } = body;

    if (!customer_name || !customer_name.trim()) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }
    if (!reservation_date || !reservation_time) {
      return NextResponse.json({ error: 'Reservation date and time are required' }, { status: 400 });
    }

    // 1. Find or create user for the guest
    let userId = null;
    const cleanName = customer_name.trim();
    const cleanPhone = phone_number ? phone_number.trim() : null;
    const cleanEmail = email ? email.trim().toLowerCase() : null;

    if (cleanPhone || cleanEmail) {
      try {
        let query = supabaseAdmin.from('users').select('id').limit(1);
        if (cleanPhone) query = query.eq('phone_number', cleanPhone);
        else if (cleanEmail) query = query.eq('email', cleanEmail);
        const { data: existingUser } = await query.maybeSingle();
        if (existingUser?.id) {
          userId = existingUser.id;
        }
      } catch (_) {}
    }

    if (!userId) {
      try {
        const tempEmail = cleanEmail || `guest_${Date.now()}_${Math.floor(Math.random() * 10000)}@tableflow.local`;
        const { data: newUser, error: uErr } = await supabaseAdmin
          .from('users')
          .insert({
            full_name: cleanName,
            phone_number: cleanPhone,
            email: tempEmail,
            role: 'customer'
          })
          .select('id')
          .maybeSingle();

        if (!uErr && newUser) {
          userId = newUser.id;
        }
      } catch (e) {
        console.warn('Guest user creation warning:', e.message);
      }
    }

    // Check maximum active table reservations policy (Max 2 active per account)
    if (userId && !body.allow_override && (status === 'confirmed' || status === 'pending')) {
      const { count: activeCount } = await supabaseAdmin
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['confirmed', 'pending']);

      if (activeCount >= 2) {
        return NextResponse.json({
          error: `Guest (${cleanName}) already has ${activeCount} active table reservations. Policy limit is maximum 2 active bookings per account.`,
          code: 'MAX_RESERVATIONS_EXCEEDED',
          activeCount
        }, { status: 400 });
      }
    }

    // 2. Format reservation time (HH:MM:SS)
    let formattedTime = reservation_time;
    if (formattedTime.length === 5) {
      formattedTime = `${formattedTime}:00`;
    }

    // 3. Insert reservation
    const targetTableId = table_id && table_id !== 'none' && table_id !== '' ? parseInt(table_id, 10) : null;

    const { data: newReservation, error: resErr } = await supabaseAdmin
      .from('reservations')
      .insert({
        user_id: userId,
        table_id: targetTableId,
        reservation_date,
        reservation_time: formattedTime,
        pax: parseInt(pax, 10) || 2,
        status: status || 'confirmed',
        special_requests: special_requests ? special_requests.trim() : null
      })
      .select('*, restaurant_tables(table_number), users(full_name, phone_number, email)')
      .single();

    if (resErr) {
      console.error('Reservation creation DB error:', resErr);
      return NextResponse.json({ error: resErr.message }, { status: 500 });
    }

    // 4. If table assigned and status confirmed, update table status to 'reserved' if available
    if (targetTableId && status === 'confirmed') {
      try {
        await supabaseAdmin
          .from('restaurant_tables')
          .update({ status: 'reserved' })
          .eq('id', targetTableId)
          .eq('status', 'available');
      } catch (_) {}
    }

    return NextResponse.json({
      message: 'Reservation created successfully',
      reservation: newReservation
    }, { status: 201 });
  } catch (err) {
    console.error('Create reservation API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
