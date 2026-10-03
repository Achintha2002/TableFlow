import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      code,
      description,
      discount_percent,
      discount_amount,
      min_order_amount,
      max_uses_per_user,
      is_active,
      valid_until
    } = body;

    const updates = {};
    if (code) updates.code = code.trim().toUpperCase();
    if (description !== undefined) updates.description = description ? description.trim() : null;
    if (discount_percent !== undefined) updates.discount_percent = Math.max(0, Math.min(100, parseInt(discount_percent, 10) || 0));
    if (discount_amount !== undefined) updates.discount_amount = Math.max(0, parseFloat(discount_amount) || 0);
    if (min_order_amount !== undefined) updates.min_order_amount = Math.max(0, parseFloat(min_order_amount) || 0);
    if (max_uses_per_user !== undefined) updates.max_uses_per_user = Math.max(1, parseInt(max_uses_per_user, 10) || 1);
    if (is_active !== undefined) updates.is_active = Boolean(is_active);
    if (valid_until !== undefined) updates.valid_until = valid_until ? new Date(valid_until).toISOString() : null;

    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, coupon: data });
  } catch (err) {
    console.error('Update coupon error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { is_active } = body;

    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update({ is_active: Boolean(is_active) })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, coupon: data });
  } catch (err) {
    console.error('Toggle coupon error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;

    // Check if there are redemptions
    const { count, error: countErr } = await supabaseAdmin
      .from('coupon_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', id);

    if (!countErr && count > 0) {
      // Soft-deactivate to protect order records
      await supabaseAdmin
        .from('coupons')
        .update({ is_active: false })
        .eq('id', id);

      return NextResponse.json({
        success: true,
        archived: true,
        message: `Coupon has ${count} existing redemption records. It was deactivated to preserve order history.`
      });
    }

    const { error } = await supabaseAdmin
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: true, message: 'Coupon deleted successfully.' });
  } catch (err) {
    console.error('Delete coupon error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
