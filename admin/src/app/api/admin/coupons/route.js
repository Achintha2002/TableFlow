import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  try {
    const { data: coupons, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase coupons error:', error);
      return NextResponse.json({
        error: error.message || 'Database error querying coupons',
        code: error.code,
        details: error.details,
        hint: error.hint
      }, { status: 500 });
    }

    // Fetch redemptions count
    const { data: redemptions, error: redErr } = await supabaseAdmin
      .from('coupon_redemptions')
      .select('coupon_id');

    const counts = {};
    if (!redErr && redemptions) {
      redemptions.forEach(r => {
        counts[r.coupon_id] = (counts[r.coupon_id] || 0) + 1;
      });
    }

    const enriched = (coupons || []).map(c => ({
      ...c,
      redemptions_count: counts[c.id] || 0,
      is_expired: c.valid_until ? new Date(c.valid_until) < new Date() : false
    }));

    return NextResponse.json({ success: true, coupons: enriched });
  } catch (err) {
    console.error('Fetch coupons error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      code,
      description,
      discount_percent,
      discount_amount,
      min_order_amount,
      max_uses_per_user,
      is_active = true,
      valid_until
    } = body;

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Coupon code is required.' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();
    const percent = Math.max(0, Math.min(100, parseInt(discount_percent, 10) || 0));
    const flatAmount = Math.max(0, parseFloat(discount_amount) || 0);

    if (percent <= 0 && flatAmount <= 0) {
      return NextResponse.json(
        { error: 'Please specify a percentage discount or a flat amount.' },
        { status: 400 }
      );
    }

    // Check duplicate
    const { data: existing } = await supabaseAdmin
      .from('coupons')
      .select('id')
      .eq('code', cleanCode)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Coupon code "${cleanCode}" already exists.` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('coupons')
      .insert([{
        code: cleanCode,
        description: description?.trim() || null,
        discount_percent: percent,
        discount_amount: flatAmount,
        min_order_amount: Math.max(0, parseFloat(min_order_amount) || 0),
        max_uses_per_user: Math.max(1, parseInt(max_uses_per_user, 10) || 1),
        is_active: is_active !== false,
        valid_until: valid_until ? new Date(valid_until).toISOString() : null
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, coupon: { ...data, redemptions_count: 0 } }, { status: 201 });
  } catch (err) {
    console.error('Create coupon error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
