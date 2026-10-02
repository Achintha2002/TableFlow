import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

function enrichMenuItem(item) {
  if (!item) return item;
  let discount_percent = Number(item.discount_percent) || 0;
  let cleanDescription = item.description || '';

  if (discount_percent <= 0 && cleanDescription.includes('[PROMO:')) {
    const match = cleanDescription.match(/\[PROMO:(\d+(?:\.\d+)?)%\]/i);
    if (match) {
      discount_percent = parseFloat(match[1]) || 0;
      cleanDescription = cleanDescription.replace(/\[PROMO:\d+(?:\.\d+)?%\]\s*/gi, '').trim();
    }
  }

  const basePrice = Number(item.price) || 0;
  const finalPrice = discount_percent > 0 
    ? Math.max(0, basePrice * (1 - discount_percent / 100))
    : basePrice;

  return {
    ...item,
    discount_percent,
    display_description: cleanDescription,
    effective_price: Math.round(finalPrice * 100) / 100
  };
}

// Helper to safely extract id in Next.js 15/16 App Router
async function extractId(req, params) {
  let id = null;
  if (params) {
    const resolved = await params;
    id = resolved?.id;
  }
  if (!id && req?.url) {
    const cleanUrl = req.url.split('?')[0];
    const parts = cleanUrl.split('/').filter(Boolean);
    id = parts[parts.length - 1];
  }
  return id;
}

// 1. Full Edit (PUT)
export async function PUT(req, { params }) {
  try {
    const id = await extractId(req, params);
    if (!id) return NextResponse.json({ error: 'Missing item ID' }, { status: 400 });

    const body = await req.json();
    const {
      name,
      category,
      price,
      discount_percent = 0,
      description = '',
      image_url,
      is_available
    } = body;

    const numPrice = parseFloat(price) || 0;
    const numDiscount = Math.min(100, Math.max(0, parseFloat(discount_percent) || 0));

    // Attempt direct update with discount_percent
    let updatePayload = {
      name: name?.trim(),
      category: category?.trim(),
      price: numPrice,
      description: description ? description.trim() : '',
      image_url: image_url !== undefined ? image_url : undefined,
      is_available: is_available !== undefined ? is_available : true,
      discount_percent: numDiscount
    };

    let { data, error } = await supabaseAdmin
      .from('menu_items')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    // Fallback if discount_percent column is missing in db
    if (error && (error.message?.includes('discount_percent') || error.code === '42703')) {
      const taggedDescription = numDiscount > 0
        ? `[PROMO:${numDiscount}%] ${updatePayload.description}`.trim()
        : updatePayload.description;

      delete updatePayload.discount_percent;
      updatePayload.description = taggedDescription;

      const fallbackResult = await supabaseAdmin
        .from('menu_items')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (fallbackResult.error) throw fallbackResult.error;
      data = fallbackResult.data;
    } else if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, item: enrichMenuItem(data) });
  } catch (err) {
    console.error('Update menu item error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. Quick Toggle (PATCH) - e.g. Sold Out / Available toggle
export async function PATCH(req, { params }) {
  try {
    const id = await extractId(req, params);
    if (!id) return NextResponse.json({ error: 'Missing item ID' }, { status: 400 });

    const body = await req.json();
    const { is_available, discount_percent } = body;

    const updates = {};
    if (typeof is_available === 'boolean') {
      updates.is_available = is_available;
    }
    if (discount_percent !== undefined) {
      updates.discount_percent = Math.min(100, Math.max(0, parseFloat(discount_percent) || 0));
    }

    let { data, error } = await supabaseAdmin
      .from('menu_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    // Fallback if discount_percent was included but column is missing
    if (error && (error.message?.includes('discount_percent') || error.code === '42703')) {
      delete updates.discount_percent;
      const fallbackResult = await supabaseAdmin
        .from('menu_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (fallbackResult.error) throw fallbackResult.error;
      data = fallbackResult.data;
    } else if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, item: enrichMenuItem(data) });
  } catch (err) {
    console.error('Patch menu item error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 3. Delete Menu Item (DELETE)
export async function DELETE(req, { params }) {
  try {
    const id = await extractId(req, params);
    if (!id) return NextResponse.json({ error: 'Missing item ID' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Menu item deleted successfully',
      deletedId: id
    });
  } catch (err) {
    console.error('Delete menu item error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
