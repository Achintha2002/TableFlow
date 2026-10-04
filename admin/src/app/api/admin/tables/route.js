import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// ── GET All Tables with Categories ──
export async function GET() {
  try {
    const { data: tables, error } = await supabaseAdmin
      .from('restaurant_tables')
      .select('*, table_categories(id, name, description)')
      .order('table_number', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(tables || []);
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
