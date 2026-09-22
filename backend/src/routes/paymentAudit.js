const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const fcmService = require('../services/fcm');

// Multer in-memory storage for bank slips (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Please upload JPG, PNG, WEBP, or PDF.'));
    }
  }
});

module.exports = function(supabaseAdmin) {

  // Auto-initialize the private bucket if needed
  async function initStorageBucket() {
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const hasBucket = buckets?.some(b => b.name === 'payment-slips');
      if (!hasBucket) {
        await supabaseAdmin.storage.createBucket('payment-slips', {
          public: false,
          fileSizeLimit: 10485760,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        });
        console.log('[Storage] Created private "payment-slips" bucket.');
      }
    } catch (err) {
      console.warn('[Storage] Bucket init notice:', err.message);
    }
  }
  initStorageBucket();

  // Helper middleware for payment verification roles: Admin, Manager, Cashier
  const requireAuditRole = async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { data: userProfile, error } = await supabaseAdmin
        .from('users')
        .select('id, role, full_name')
        .eq('id', req.user.id)
        .maybeSingle();

      if (error || !userProfile) {
        return res.status(403).json({ error: 'Forbidden: Profile not found' });
      }

      const allowedRoles = ['admin', 'manager', 'cashier', 'staff'];
      if (!allowedRoles.includes(userProfile.role)) {
        return res.status(403).json({
          error: `Forbidden: Verification desk access requires Admin, Manager, or Cashier role. Current: ${userProfile.role}`
        });
      }

      req.auditUser = userProfile;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // ==============================================================================
  // 1. Customer Places Order with Bank Transfer Slip
  // ==============================================================================
  router.post('/orders/with-slip', authMiddleware, upload.single('slip'), async (req, res) => {
    try {
      const {
        transaction_reference,
        bank_name,
        reservation_id,
        table_id,
        special_notes,
        coupon_code,
        redeem_points = 0
      } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Payment slip image or PDF is required.' });
      }

      if (!transaction_reference || !transaction_reference.trim()) {
        return res.status(400).json({ error: 'Transaction / Bank Reference Number is required.' });
      }

      const cleanRef = transaction_reference.trim().toUpperCase();

      // Check unique constraint for duplicate transaction reference
      const { data: existingRef } = await supabaseAdmin
        .from('payment_transactions')
        .select('id, order_id, status, created_at')
        .eq('transaction_reference', cleanRef)
        .maybeSingle();

      if (existingRef) {
        return res.status(409).json({
          error: `Transaction Reference "${cleanRef}" has already been submitted for Order #${existingRef.order_id}. Duplicate payments are not allowed.`
        });
      }

      // Parse items
      let items = [];
      try {
        items = typeof req.body.items === 'string' ? JSON.parse(req.body.items) : (req.body.items || []);
      } catch (_) {
        return res.status(400).json({ error: 'Invalid items JSON structure' });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order must contain at least one item.' });
      }

      // Recompute Prices & Inventory availability Server-Side
      const itemIds = items.map(i => i.menu_item_id);
      const { data: menuItems, error: menuErr } = await supabaseAdmin
        .from('menu_items')
        .select('id, name, price, prep_time_minutes, is_available, stock_quantity, reserved_quantity, customizations')
        .in('id', itemIds);

      if (menuErr) throw menuErr;

      const menuMap = new Map();
      (menuItems || []).forEach(m => menuMap.set(m.id, m));

      let serverSubtotal = 0;
      let maxPrepTime = 15;

      for (const item of items) {
        const dbItem = menuMap.get(item.menu_item_id);
        if (!dbItem) {
          return res.status(400).json({ error: `Menu item with ID ${item.menu_item_id} not found` });
        }
        if (dbItem.is_available === false) {
          return res.status(400).json({ error: `Item "${dbItem.name}" is currently sold out.` });
        }

        const quantity = parseInt(item.quantity, 10) || 1;
        const currentStock = dbItem.stock_quantity ?? 100;
        const currentReserved = dbItem.reserved_quantity ?? 0;
        const availableStock = currentStock - currentReserved;

        if (availableStock < quantity) {
          return res.status(400).json({
            error: `Insufficient stock for "${dbItem.name}". Only ${Math.max(0, availableStock)} available.`
          });
        }

        const basePrice = parseFloat(dbItem.price);
        let sizeDelta = 0;
        let addonsTotal = 0;
        const noteParts = [];

        if (item.selected_customizations) {
          const cust = item.selected_customizations;
          if (cust.size && cust.size.price_delta) {
            sizeDelta += parseFloat(cust.size.price_delta) || 0;
            noteParts.push(`[${cust.size.name || 'Size'}]`);
          }
          if (Array.isArray(cust.addons)) {
            for (const add of cust.addons) {
              const addQty = parseInt(add.qty, 10) || 1;
              const addPrice = parseFloat(add.price) || 0;
              addonsTotal += addPrice * addQty;
              noteParts.push(`+ ${add.name || 'Add-on'}${addQty > 1 ? ` (x${addQty})` : ''}`);
            }
          }
          if (cust.preference) {
            noteParts.push(`• ${cust.preference}`);
          }
        }

        const unitPrice = basePrice + sizeDelta + addonsTotal;
        item.unit_price = unitPrice;
        item.item_notes = noteParts.length > 0 ? noteParts.join(' ') : (item.item_notes || null);
        serverSubtotal += unitPrice * quantity;

        if (dbItem.prep_time_minutes && dbItem.prep_time_minutes > maxPrepTime) {
          maxPrepTime = dbItem.prep_time_minutes;
        }
      }

      // Calculate totals
      let couponDiscount = 0;
      if (coupon_code) {
        const { data: coupon } = await supabaseAdmin
          .from('coupons')
          .select('*')
          .eq('code', coupon_code.trim().toUpperCase())
          .eq('is_active', true)
          .maybeSingle();

        if (coupon && serverSubtotal >= (coupon.min_order_amount || 0)) {
          if (coupon.discount_percent > 0) {
            couponDiscount = (serverSubtotal * coupon.discount_percent) / 100;
          } else if (coupon.discount_amount > 0) {
            couponDiscount = Math.min(coupon.discount_amount, serverSubtotal);
          }
        }
      }

      const pointsDiscount = Math.min(Math.max(0, parseInt(redeem_points, 10) || 0), Math.max(0, serverSubtotal - couponDiscount));
      const totalDiscount = Math.round((couponDiscount + pointsDiscount) * 100) / 100;
      const discountedSubtotal = Math.max(0, serverSubtotal - totalDiscount);
      const serviceCharge = Math.round(discountedSubtotal * 0.10 * 100) / 100;
      const taxAmount = Math.round(discountedSubtotal * 0.08 * 100) / 100;
      const serverTotal = Math.round((discountedSubtotal + serviceCharge + taxAmount) * 100) / 100;

      // Target serve time
      const targetServeTime = new Date(Date.now() + maxPrepTime * 60 * 1000);

      // 1. Upload Slip to private Supabase Storage
      const fileExt = req.file.originalname.split('.').pop() || 'jpg';
      const slipPath = `${req.user.id}/${Date.now()}_${Math.round(Math.random() * 10000)}.${fileExt}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('payment-slips')
        .upload(slipPath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadErr) {
        throw new Error(`Failed to upload payment slip: ${uploadErr.message}`);
      }

      // 2. Create the Order in 'payment_pending'
      const { data: newOrder, error: orderErr } = await supabaseAdmin
        .from('orders')
        .insert({
          user_id: req.user.id,
          reservation_id: reservation_id || null,
          table_id: table_id || null,
          subtotal: serverSubtotal,
          discount_amount: totalDiscount,
          service_charge: serviceCharge,
          tax_amount: taxAmount,
          total_amount: serverTotal,
          status: 'payment_pending',
          payment_status: 'pending',
          payment_method: 'bank_transfer',
          prep_time_minutes: maxPrepTime,
          target_serve_time: targetServeTime.toISOString(),
          special_notes: special_notes || null
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 3. Create Order Items
      const orderItems = items.map(item => ({
        order_id: newOrder.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        item_notes: item.item_notes || null,
        selected_customizations: item.selected_customizations || null
      }));

      await supabaseAdmin.from('order_items').insert(orderItems);

      // 4. Reserve Inventory (RPC with atomic row lock or JS fallback)
      try {
        const { error: rpcErr } = await supabaseAdmin.rpc('reserve_inventory_for_order', {
          p_order_id: newOrder.id,
          p_items: items
        });

        if (rpcErr) {
          // JS Fallback
          for (const item of items) {
            const dbItem = menuMap.get(item.menu_item_id);
            const curRes = dbItem?.reserved_quantity || 0;
            await supabaseAdmin
              .from('menu_items')
              .update({ reserved_quantity: curRes + (parseInt(item.quantity, 10) || 1) })
              .eq('id', item.menu_item_id);
          }
        }
      } catch (stockErr) {
        console.warn('Inventory reservation warning:', stockErr.message);
      }

      // 5. Insert Payment Transaction Record
      const { data: transaction, error: transErr } = await supabaseAdmin
        .from('payment_transactions')
        .insert({
          order_id: newOrder.id,
          user_id: req.user.id,
          payment_method: 'bank_transfer',
          slip_path: slipPath,
          transaction_reference: cleanRef,
          bank_name: bank_name ? bank_name.trim() : null,
          amount_paid: serverTotal,
          status: 'pending_verification'
        })
        .select()
        .single();

      if (transErr) {
        console.warn('Payment transaction insert notice:', transErr.message);
      }

      // 6. Generate a signed URL for customer preview (valid 1 hour)
      const { data: signedData } = await supabaseAdmin.storage
        .from('payment-slips')
        .createSignedUrl(slipPath, 3600);

      res.status(201).json({
        success: true,
        message: 'Order placed successfully! Your payment slip has been submitted for staff verification.',
        order: newOrder,
        transaction: transaction || null,
        slip_url: signedData?.signedUrl || null
      });
    } catch (err) {
      console.error('Payment with slip error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ==============================================================================
  // 2. Customer Re-submits Slip After Rejection
  // ==============================================================================
  router.post('/orders/:id/payment-proof', authMiddleware, upload.single('slip'), async (req, res) => {
    try {
      const orderId = req.params.id;
      const { transaction_reference, bank_name } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Payment slip is required.' });
      }
      if (!transaction_reference || !transaction_reference.trim()) {
        return res.status(400).json({ error: 'Transaction Reference Number is required.' });
      }

      const cleanRef = transaction_reference.trim().toUpperCase();

      // Ensure order exists and belongs to user
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .eq('user_id', req.user.id)
        .single();

      if (orderErr || !order) {
        return res.status(404).json({ error: 'Order not found or unauthorized.' });
      }

      if (order.status !== 'payment_rejected' && order.status !== 'payment_pending') {
        return res.status(400).json({ error: `Cannot re-submit slip for order with status "${order.status}".` });
      }

      // Check unique constraint for duplicate transaction reference
      const { data: existingRef } = await supabaseAdmin
        .from('payment_transactions')
        .select('id, order_id')
        .eq('transaction_reference', cleanRef)
        .neq('order_id', orderId)
        .maybeSingle();

      if (existingRef) {
        return res.status(409).json({
          error: `Transaction Reference "${cleanRef}" is already used for another order.`
        });
      }

      // Upload new slip
      const fileExt = req.file.originalname.split('.').pop() || 'jpg';
      const slipPath = `${req.user.id}/${Date.now()}_re_${Math.round(Math.random() * 10000)}.${fileExt}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('payment-slips')
        .upload(slipPath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadErr) throw uploadErr;

      // Re-reserve stock if order was rejected
      if (order.status === 'payment_rejected' && order.order_items) {
        for (const oi of order.order_items) {
          const { data: mItem } = await supabaseAdmin.from('menu_items').select('reserved_quantity').eq('id', oi.menu_item_id).single();
          if (mItem) {
            await supabaseAdmin.from('menu_items').update({
              reserved_quantity: (mItem.reserved_quantity || 0) + (oi.quantity || 1)
            }).eq('id', oi.menu_item_id);
          }
        }
      }

      // Update or create payment_transactions
      const { data: newTrans } = await supabaseAdmin
        .from('payment_transactions')
        .upsert({
          order_id: order.id,
          user_id: req.user.id,
          payment_method: 'bank_transfer',
          slip_path: slipPath,
          transaction_reference: cleanRef,
          bank_name: bank_name ? bank_name.trim() : null,
          amount_paid: order.total_amount,
          status: 'pending_verification',
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      // Set order status back to payment_pending
      await supabaseAdmin
        .from('orders')
        .update({
          status: 'payment_pending',
          payment_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      const { data: signedData } = await supabaseAdmin.storage
        .from('payment-slips')
        .createSignedUrl(slipPath, 3600);

      res.json({
        success: true,
        message: 'Payment proof re-submitted successfully. Staff will review shortly.',
        transaction: newTrans,
        slip_url: signedData?.signedUrl
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==============================================================================
  // 3. Admin / Manager / Cashier: List Pending Payment Verifications
  // ==============================================================================
  router.get('/admin/orders/pending-verification', authMiddleware, requireAuditRole, async (req, res) => {
    try {
      // Find orders with payment_pending or payment_transactions with pending_verification
      const { data: orders, error } = await supabaseAdmin
        .from('orders')
        .select(`
          *,
          users(id, full_name, email, phone_number),
          restaurant_tables(id, table_number),
          order_items(
            id,
            quantity,
            unit_price,
            item_notes,
            selected_customizations,
            menu_items(id, name, price, image_url)
          )
        `)
        .in('status', ['payment_pending', 'payment_rejected'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!orders || orders.length === 0) {
        return res.json({ orders: [], count: 0 });
      }

      // Fetch payment transactions for these orders
      const orderIds = orders.map(o => o.id);
      const { data: transactions } = await supabaseAdmin
        .from('payment_transactions')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      const transMap = new Map();
      (transactions || []).forEach(t => {
        if (!transMap.has(t.order_id)) {
          transMap.set(t.order_id, t);
        }
      });

      // Generate short-lived signed URLs (10 min = 600s) for private slips
      const enrichedOrders = await Promise.all(orders.map(async (order) => {
        const trans = transMap.get(order.id) || null;
        let signedUrl = null;

        if (trans && trans.slip_path) {
          try {
            const { data: sData } = await supabaseAdmin.storage
              .from('payment-slips')
              .createSignedUrl(trans.slip_path, 600);
            signedUrl = sData?.signedUrl || null;
          } catch (_) {}
        }

        return {
          ...order,
          payment_transaction: trans ? { ...trans, slip_url: signedUrl } : null
        };
      }));

      res.json({
        orders: enrichedOrders,
        count: enrichedOrders.length
      });
    } catch (err) {
      console.error('List pending verification error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ==============================================================================
  // 4. Admin / Manager / Cashier: Verify Payment (Approve or Reject)
  // ==============================================================================
  router.patch('/admin/orders/:id/verify', authMiddleware, requireAuditRole, async (req, res) => {
    try {
      const orderId = req.params.id;
      const { action, rejection_reason } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be either "approve" or "reject".' });
      }

      // Fetch the order
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single();

      if (orderErr || !order) {
        return res.status(404).json({ error: `Order #${orderId} not found.` });
      }

      const now = new Date().toISOString();

      if (action === 'approve') {
        // 1. Commit inventory permanently (RPC with fallback)
        try {
          const { error: rpcErr } = await supabaseAdmin.rpc('commit_reserved_stock', { p_order_id: order.id });
          if (rpcErr && order.order_items) {
            for (const oi of order.order_items) {
              const { data: m } = await supabaseAdmin.from('menu_items').select('stock_quantity, reserved_quantity').eq('id', oi.menu_item_id).single();
              if (m) {
                await supabaseAdmin.from('menu_items').update({
                  stock_quantity: Math.max(0, (m.stock_quantity ?? 100) - (oi.quantity || 1)),
                  reserved_quantity: Math.max(0, (m.reserved_quantity ?? 0) - (oi.quantity || 1))
                }).eq('id', oi.menu_item_id);
              }
            }
          }
        } catch (stockErr) {
          console.warn('Commit reserved stock warning:', stockErr.message);
        }

        // 2. Set order status = 'pending' and payment_status = 'paid'
        // Moving to 'pending' immediately routes order to Kitchen Display System (KDS) & Waiter flow!
        const { data: updatedOrder, error: updateErr } = await supabaseAdmin
          .from('orders')
          .update({
            status: 'pending',
            payment_status: 'paid',
            updated_at: now
          })
          .eq('id', order.id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        // 3. Update payment_transactions
        await supabaseAdmin
          .from('payment_transactions')
          .update({
            status: 'approved',
            reviewed_by: req.user.id,
            reviewed_at: now,
            updated_at: now
          })
          .eq('order_id', order.id);

        // 4. Send real-time FCM notification to customer
        if (order.user_id) {
          try {
            await fcmService.sendToUser(order.user_id, {
              title: 'Payment Verified! 🎉',
              body: `Your payment for Order #${order.id} has been confirmed. The kitchen has started preparing your food!`,
              data: {
                type: 'order_status',
                order_id: String(order.id),
                status: 'pending',
                payment_status: 'paid'
              },
              type: 'order_status'
            });
          } catch (notifErr) {
            console.warn('FCM dispatch notice:', notifErr.message);
          }
        }

        return res.json({
          success: true,
          message: `Order #${order.id} payment verified successfully and sent to Kitchen!`,
          order: updatedOrder
        });

      } else {
        // REJECT ACTION
        const reason = (rejection_reason || 'Payment slip details could not be verified or amount mismatched.').trim();

        // 1. Release reserved stock back to available pool
        try {
          const { error: rpcErr } = await supabaseAdmin.rpc('release_reserved_stock', { p_order_id: order.id });
          if (rpcErr && order.order_items) {
            for (const oi of order.order_items) {
              const { data: m } = await supabaseAdmin.from('menu_items').select('reserved_quantity').eq('id', oi.menu_item_id).single();
              if (m) {
                await supabaseAdmin.from('menu_items').update({
                  reserved_quantity: Math.max(0, (m.reserved_quantity ?? 0) - (oi.quantity || 1))
                }).eq('id', oi.menu_item_id);
              }
            }
          }
        } catch (stockErr) {
          console.warn('Release reserved stock warning:', stockErr.message);
        }

        // 2. Set order status = 'payment_rejected' and payment_status = 'failed'
        const { data: updatedOrder, error: updateErr } = await supabaseAdmin
          .from('orders')
          .update({
            status: 'payment_rejected',
            payment_status: 'failed',
            updated_at: now
          })
          .eq('id', order.id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        // 3. Update payment_transactions with rejection reason
        await supabaseAdmin
          .from('payment_transactions')
          .update({
            status: 'rejected',
            rejection_reason: reason,
            reviewed_by: req.user.id,
            reviewed_at: now,
            updated_at: now
          })
          .eq('order_id', order.id);

        // 4. Send FCM alert to customer
        if (order.user_id) {
          try {
            await fcmService.sendToUser(order.user_id, {
              title: 'Payment Verification Failed ⚠️',
              body: `Reason: ${reason}. Tap to upload a valid payment slip.`,
              data: {
                type: 'order_status',
                order_id: String(order.id),
                status: 'payment_rejected',
                rejection_reason: reason
              },
              type: 'order_status'
            });
          } catch (notifErr) {
            console.warn('FCM dispatch notice:', notifErr.message);
          }
        }

        return res.json({
          success: true,
          message: `Order #${order.id} payment was rejected. Customer notified.`,
          order: updatedOrder
        });
      }
    } catch (err) {
      console.error('Verify payment error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
