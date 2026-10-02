import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// Helper to extract promo discount from description if column doesn't exist
function enrichMenuItem(item) {
  if (!item) return item;
  let discount_percent = Number(item.discount_percent) || 0;
  let cleanDescription = item.description || '';

  // If discount_percent column is not present or 0, check for [PROMO:X%] tag
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

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    const enriched = (data || []).map(enrichMenuItem);
    return NextResponse.json({ success: true, items: enriched });
  } catch (err) {
    console.error('Fetch menu items error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      name,
      category = 'Mains',
      price = 0,
      discount_percent = 0,
      description = '',
      image_url = '',
      is_available = true
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    const numPrice = parseFloat(price) || 0;
    const numDiscount = Math.min(100, Math.max(0, parseFloat(discount_percent) || 0));

    // Attempt 1: Insert with discount_percent column
    let payload = {
      name: name.trim(),
      category: category.trim(),
      price: numPrice,
      description: description ? description.trim() : '',
      image_url: image_url ? image_url.trim() : null,
      is_available: is_available !== false,
      discount_percent: numDiscount
    };

    let { data, error } = await supabaseAdmin
      .from('menu_items')
      .insert(payload)
      .select()
      .single();

    // If database complains discount_percent column does not exist, fallback to promo tag in description
    if (error && (error.message?.includes('discount_percent') || error.code === '42703')) {
      const taggedDescription = numDiscount > 0
        ? `[PROMO:${numDiscount}%] ${payload.description}`.trim()
        : payload.description;

      const fallbackPayload = {
        name: payload.name,
        category: payload.category,
        price: payload.price,
        description: taggedDescription,
        image_url: payload.image_url,
        is_available: payload.is_available
      };

      const fallbackResult = await supabaseAdmin
        .from('menu_items')
        .insert(fallbackPayload)
        .select()
        .single();

      if (fallbackResult.error) throw fallbackResult.error;
      data = fallbackResult.data;
    } else if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      item: enrichMenuItem(data)
    });
  } catch (err) {
    console.error('Create menu item error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
