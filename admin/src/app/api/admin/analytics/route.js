import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    // 1. Fetch orders for the last 7 days to calculate daily revenue
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('created_at, total_amount')
      .gte('created_at', sevenDaysAgo.toISOString())
      .in('status', ['served', 'ready', 'pending', 'preparing']); // include all active for demo purposes

    if (ordersError) throw ordersError;

    // Aggregate revenue by date
    const revenueByDay = {};
    // Initialize last 7 days with 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      revenueByDay[dateStr] = 0;
    }

    orders.forEach(o => {
      const dateStr = o.created_at.split('T')[0];
      if (revenueByDay[dateStr] !== undefined) {
        revenueByDay[dateStr] += Number(o.total_amount);
      }
    });

    const revenueData = Object.keys(revenueByDay).map(date => ({
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: revenueByDay[date]
    }));

    // 2. Fetch popular items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        quantity,
        menu_items ( name )
      `);
      
    if (itemsError) throw itemsError;

    const itemCounts = {};
    orderItems.forEach(item => {
      const name = item.menu_items?.name || 'Unknown';
      itemCounts[name] = (itemCounts[name] || 0) + item.quantity;
    });

    const popularItemsData = Object.keys(itemCounts)
      .map(name => ({ name, count: itemCounts[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // top 5

    return NextResponse.json({
      revenue: revenueData,
      popularItems: popularItemsData
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
