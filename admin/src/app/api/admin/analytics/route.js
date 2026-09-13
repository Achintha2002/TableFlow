import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    let startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    if (startDateParam) startDate = new Date(startDateParam);

    let endDate = new Date();
    if (endDateParam) {
      endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
    }

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('created_at, total_amount, status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (ordersError) throw ordersError;

    // Aggregate revenue by date
    const revenueByDay = {};
    const statusCounts = {};

    orders.forEach(o => {
      // Revenue
      const dateStr = o.created_at.split('T')[0];
      if (!revenueByDay[dateStr]) revenueByDay[dateStr] = 0;
      if (['served', 'ready', 'pending', 'preparing'].includes(o.status)) {
        revenueByDay[dateStr] += Number(o.total_amount);
      }

      // Status
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    const revenueData = Object.keys(revenueByDay).map(date => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: revenueByDay[date]
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    // 2. Fetch popular items for this date range
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        quantity,
        orders!inner(created_at),
        menu_items ( name )
      `)
      .gte('orders.created_at', startDate.toISOString())
      .lte('orders.created_at', endDate.toISOString());
      
    if (itemsError) throw itemsError;

    const itemCounts = {};
    orderItems.forEach(item => {
      const name = item.menu_items?.name || 'Unknown';
      itemCounts[name] = (itemCounts[name] || 0) + item.quantity;
    });

    const popularItemsData = Object.keys(itemCounts)
      .map(name => ({ name, count: itemCounts[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // top 10

    // Provide raw orders for CSV export
    const rawOrders = orders.map(o => ({
      date: o.created_at,
      amount: o.total_amount,
      status: o.status
    }));

    return NextResponse.json({
      revenue: revenueData,
      popularItems: popularItemsData,
      statusCounts,
      rawOrders
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
