/**
 * TableFlow - Bank Transfer Order Auto-Expiry Job
 * Automatically cancels orders stuck in 'payment_pending' after 24 hours
 * and safely releases reserved stock back to the menu.
 */

const fcmService = require('../services/fcm');

let isRunning = false;

async function runOrderExpiryCheck(supabaseAdmin) {
  if (isRunning) return;
  isRunning = true;

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Find orders stuck in payment_pending older than 24 hours
    const { data: expiredOrders, error: findError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, status, created_at, order_items(menu_item_id, quantity)')
      .eq('status', 'payment_pending')
      .lt('created_at', twentyFourHoursAgo);

    if (findError) {
      // payment_pending might not have any records, ignore error
      isRunning = false;
      return;
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`[Order Expiry] Found ${expiredOrders.length} expired bank transfer order(s) to cancel.`);

    for (const order of expiredOrders) {
      // Atomic status update: only update if status is still payment_pending (race condition protection)
      const { data: updatedOrder, error: updateErr } = await supabaseAdmin
        .from('orders')
        .update({
          status: 'cancelled',
          payment_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .eq('status', 'payment_pending')
        .select()
        .maybeSingle();

      if (updateErr || !updatedOrder) {
        // Already processed or changed status
        continue;
      }

      // 2. Release reserved stock
      try {
        const { error: rpcErr } = await supabaseAdmin.rpc('release_reserved_stock', { p_order_id: order.id });
        if (rpcErr && order.order_items) {
          // JS Fallback if RPC not installed
          for (const item of order.order_items) {
            const { data: mItem } = await supabaseAdmin
              .from('menu_items')
              .select('reserved_quantity')
              .eq('id', item.menu_item_id)
              .maybeSingle();
            if (mItem && mItem.reserved_quantity !== undefined) {
              await supabaseAdmin
                .from('menu_items')
                .update({
                  reserved_quantity: Math.max(0, (mItem.reserved_quantity || 0) - (item.quantity || 1))
                })
                .eq('id', item.menu_item_id);
            }
          }
        }
      } catch (stockErr) {
        console.warn(`[Order Expiry] Could not release reserved stock for order #${order.id}:`, stockErr.message);
      }

      // 3. Mark payment transaction as rejected if exists
      try {
        await supabaseAdmin
          .from('payment_transactions')
          .update({
            status: 'rejected',
            rejection_reason: 'Order automatically expired after 24 hours without payment verification.',
            updated_at: new Date().toISOString()
          })
          .eq('order_id', order.id)
          .eq('status', 'pending_verification');
      } catch (_) {}

      // 4. Send FCM alert to customer
      if (order.user_id) {
        try {
          await fcmService.sendToUser(order.user_id, {
            title: 'Order Expired ⏱️',
            body: `Your bank transfer order #${order.id} expired after 24 hours without verified payment.`,
            data: {
              type: 'order_update',
              order_id: String(order.id),
              status: 'cancelled'
            },
            type: 'order_status'
          });
        } catch (_) {}
      }

      console.log(`[Order Expiry] Order #${order.id} successfully cancelled & stock released.`);
    }
  } catch (err) {
    console.error('[Order Expiry] Unexpected error during expiry run:', err);
  } finally {
    isRunning = false;
  }
}

function startOrderExpiryScheduler(supabaseAdmin, intervalMs = 15 * 60 * 1000) {
  // Run on startup after 10 seconds
  setTimeout(() => runOrderExpiryCheck(supabaseAdmin), 10000);
  // Recurring interval
  const intervalId = setInterval(() => runOrderExpiryCheck(supabaseAdmin), intervalMs);
  return intervalId;
}

module.exports = {
  startOrderExpiryScheduler,
  runOrderExpiryCheck
};
