import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        user_id,
        table_id,
        total_amount,
        status,
        payment_status,
        payment_method,
        special_notes,
        created_at,
        users (id, full_name, email),
        restaurant_tables (id, table_number),
        order_items (id, menu_item_id, quantity, unit_price, menu_items(name, price))
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Fetch orders error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sanitized = (orders || []).map(o => ({
      ...o,
      subtotal: o.total_amount || 0,
      discount_amount: 0
    }));

    return NextResponse.json({ success: true, orders: sanitized });
  } catch (err) {
    console.error('API orders error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
