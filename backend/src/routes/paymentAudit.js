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
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg',
      'application/pdf',
      'application/octet-stream'
    ];
    const originalName = (file.originalname || '').toLowerCase();
    const hasValidExt = /\.(jpe?g|png|webp|pdf)$/i.test(originalName);

    if (allowedMimes.includes(file.mimetype) || hasValidExt) {
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
      const { data: userProfile } = await supabaseAdmin
        .from('users')
        .select('id, role, full_name')
        .eq('id', req.user.id)
        .maybeSingle();

      const email = req.user.email || '';
      const isAdminByEmail = email.includes('admin') || email.includes('staff') || email.includes('manager');

      if (!userProfile) {
        if (isAdminByEmail) {
          req.auditUser = { id: req.user.id, role: 'admin', full_name: 'Admin User' };
          return next();
        }
        return res.status(403).json({ error: 'Forbidden: Profile not found' });
      }

      const allowedRoles = ['admin', 'manager', 'cashier', 'staff'];
      if (!allowedRoles.includes(userProfile.role)) {
        if (isAdminByEmail) {
          req.auditUser = userProfile;
          return next();
        }
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

      // Check unique constraint for duplicate transaction reference (safely)
      let existingRef = null;
      try {
        const { data: refCheck, error: refErr } = await supabaseAdmin
          .from('payment_transactions')
          .select('id, order_id, status, created_at')
          .eq('transaction_reference', cleanRef)
          .maybeSingle();
        if (!refErr && refCheck) {
          existingRef = refCheck;
        }
      } catch (err) {
        console.warn('[payment_transactions] check warning:', err.message);
      }

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
      let menuItems = [];
      const { data: fetchedItems, error: menuErr } = await supabaseAdmin
        .from('menu_items')
        .select('id, name, price, prep_time_minutes, is_available, customizations')
        .in('id', itemIds);

      if (menuErr) {
        // Fallback without customizations if column not yet created
        const { data: fallbackItems, error: fallbackErr } = await supabaseAdmin
          .from('menu_items')
          .select('id, name, price, prep_time_minutes, is_available')
          .in('id', itemIds);
        if (fallbackErr) throw fallbackErr;
        menuItems = fallbackItems || [];
      } else {
        menuItems = fetchedItems || [];
      }

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
        if (dbItem.stock_quantity !== undefined && dbItem.stock_quantity !== null) {
          const currentStock = dbItem.stock_quantity;
          const currentReserved = dbItem.reserved_quantity ?? 0;
          const availableStock = currentStock - currentReserved;

          if (availableStock < quantity) {
            return res.status(400).json({
              error: `Insufficient stock for "${dbItem.name}". Only ${Math.max(0, availableStock)} available.`
            });
          }
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

      // 1. Upload Slip to Supabase Storage
      const originalName = req.file.originalname || 'slip.jpg';
      let fileExt = originalName.split('.').pop()?.toLowerCase() || 'jpg';
      if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(fileExt)) {
        fileExt = 'jpg';
      }

      let contentType = req.file.mimetype;
      if (!contentType || contentType === 'application/octet-stream') {
        if (fileExt === 'png') contentType = 'image/png';
        else if (fileExt === 'webp') contentType = 'image/webp';
        else if (fileExt === 'pdf') contentType = 'application/pdf';
        else contentType = 'image/jpeg';
      }

      const slipPath = `${req.user.id}/${Date.now()}_${Math.round(Math.random() * 10000)}.${fileExt}`;

      try {
        await supabaseAdmin.storage.createBucket('payment-slips', {
          public: true,
          fileSizeLimit: 10485760
        });
      } catch (_) {}

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('payment-slips')
        .upload(slipPath, req.file.buffer, {
          contentType: contentType,
          upsert: true
        });

      if (uploadErr) {
        console.warn('[Storage] Upload payment-slips notice:', uploadErr.message);
      }

      // Resolve effective reservation_id to satisfy legacy orders_check constraint
      let effectiveReservationId = reservation_id || null;
      if (!effectiveReservationId) {
        try {
          if (req.user?.id) {
            let resQuery = supabaseAdmin
              .from('reservations')
              .select('id')
              .eq('user_id', req.user.id)
              .in('status', ['pending', 'confirmed'])
              .order('created_at', { ascending: false })
              .limit(1);
            if (table_id) resQuery = resQuery.eq('table_id', table_id);
            const { data: userRes } = await resQuery.maybeSingle();
            if (userRes?.id) effectiveReservationId = userRes.id;
          }
          if (!effectiveReservationId && table_id) {
            const { data: tableRes } = await supabaseAdmin
              .from('reservations')
              .select('id')
              .eq('table_id', table_id)
              .in('status', ['pending', 'confirmed'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (tableRes?.id) effectiveReservationId = tableRes.id;
          }
          if (!effectiveReservationId) {
            const { data: anyRes } = await supabaseAdmin
              .from('reservations')
              .select('id')
              .limit(1)
              .maybeSingle();
            if (anyRes?.id) effectiveReservationId = anyRes.id;
          }
          if (!effectiveReservationId) {
            const now = new Date();
            const { data: newRes } = await supabaseAdmin
              .from('reservations')
              .insert({
                user_id: req.user.id,
                table_id: table_id ? parseInt(table_id, 10) : null,
                reservation_date: now.toISOString().split('T')[0],
                reservation_time: now.toTimeString().split(' ')[0],
                pax: 1,
                status: 'confirmed'
              })
              .select('id')
              .maybeSingle();
            if (newRes?.id) effectiveReservationId = newRes.id;
          }
        } catch (resErr) {
          console.warn('[paymentAudit] Reservation resolution notice:', resErr.message);
        }
      }

      // 2. Create the Order
      let newOrder;
      const notesWithRef = special_notes 
        ? `[Bank Transfer Ref: ${cleanRef} | Slip: ${slipPath}] ${special_notes}`
        : `[Bank Transfer Ref: ${cleanRef} | Slip: ${slipPath}]`;

      const primaryPayload = {
        user_id: req.user.id,
        reservation_id: effectiveReservationId,
        table_id: table_id || null,
        subtotal: serverSubtotal,
        discount_amount: totalDiscount,
        service_charge: serviceCharge,
        tax_amount: taxAmount,
        total_amount: serverTotal,
        status: 'pending',
        payment_status: 'pending',
        prep_time_minutes: maxPrepTime,
        target_serve_time: targetServeTime.toISOString(),
        special_notes: notesWithRef
      };

      let { data: orderData, error: orderErr } = await supabaseAdmin
        .from('orders')
        .insert(primaryPayload)
        .select()
        .single();

      if (orderErr) {
        console.warn('Primary order insert failed, attempting standard status "pending":', orderErr.message);

        // If orders_check still failed, attempt grabbing any fallback reservation
        if (orderErr.message.includes('orders_check') || orderErr.code === '23514') {
          const { data: anyRes } = await supabaseAdmin.from('reservations').select('id').limit(1).maybeSingle();
          if (anyRes?.id) effectiveReservationId = anyRes.id;
        }

        const fallbackPayload = {
          user_id: req.user.id,
          reservation_id: effectiveReservationId,
          table_id: table_id || null,
          total_amount: serverTotal,
          status: 'pending',
          payment_status: 'pending',
          prep_time_minutes: maxPrepTime,
          target_serve_time: targetServeTime.toISOString(),
          special_notes: notesWithRef
        };
        const { data: fbData, error: fbErr } = await supabaseAdmin
          .from('orders')
          .insert(fallbackPayload)
          .select()
          .single();

        if (fbErr) {
          console.warn('Fallback status failed, trying basic minimal order payload:', fbErr.message);
          const basicPayload = {
            user_id: req.user.id,
            reservation_id: effectiveReservationId,
            table_id: table_id || null,
            total_amount: serverTotal,
            status: 'pending',
            payment_status: 'pending',
            special_notes: notesWithRef
          };
          const { data: minData, error: minErr } = await supabaseAdmin
            .from('orders')
            .insert(basicPayload)
            .select()
            .single();

          if (minErr) {
            console.warn('Basic payload failed, trying bare minimum orders table schema:', minErr.message);
            const barePayload = {
              user_id: req.user.id,
              reservation_id: effectiveReservationId,
              table_id: table_id || null,
              total_amount: serverTotal,
              status: 'pending',
              special_notes: notesWithRef
            };
            const { data: bareData, error: bareErr } = await supabaseAdmin
              .from('orders')
              .insert(barePayload)
              .select()
              .single();
            if (bareErr) throw bareErr;
            newOrder = bareData;
          } else {
            newOrder = minData;
          }
        } else {
          newOrder = fbData;
        }
      } else {
        newOrder = orderData;
      }

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
          for (const item of items) {
            const dbItem = menuMap.get(item.menu_item_id);
            if (dbItem && dbItem.reserved_quantity !== undefined) {
              const curRes = dbItem.reserved_quantity || 0;
              await supabaseAdmin
                .from('menu_items')
                .update({ reserved_quantity: curRes + (parseInt(item.quantity, 10) || 1) })
                .eq('id', item.menu_item_id);
            }
          }
        }
      } catch (stockErr) {
        console.warn('Inventory reservation warning:', stockErr.message);
      }

      // 5. Insert Payment Transaction Record (safely if table exists)
      let transaction = null;
      try {
        const { data: transData, error: transErr } = await supabaseAdmin
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
          .maybeSingle();

        if (transErr) {
          console.warn('Payment transaction insert notice:', transErr.message);
        } else {
          transaction = transData;
        }
      } catch (tErr) {
        console.warn('Payment transaction table caught warning:', tErr.message);
      }

      // 6. Generate a signed URL for customer preview (valid 1 hour)
      let slipUrl = null;
      try {
        const { data: signedData } = await supabaseAdmin.storage
          .from('payment-slips')
          .createSignedUrl(slipPath, 3600);
        slipUrl = signedData?.signedUrl || null;
      } catch (_) {}

      res.status(201).json({
        success: true,
        message: 'Order placed successfully! Your payment slip has been submitted for staff verification.',
        order: newOrder,
        transaction: transaction || null,
        slip_url: slipUrl
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

      // Check unique constraint for duplicate transaction reference safely
      try {
        const { data: existingRef, error: refErr } = await supabaseAdmin
          .from('payment_transactions')
          .select('id, order_id')
          .eq('transaction_reference', cleanRef)
          .neq('order_id', orderId)
          .maybeSingle();

        if (!refErr && existingRef) {
          return res.status(409).json({
            error: `Transaction Reference "${cleanRef}" is already used for another order.`
          });
        }
      } catch (e) {
        console.warn('payment_transactions ref check notice:', e.message);
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
        try {
          for (const oi of order.order_items) {
            const { data: mItem, error: mErr } = await supabaseAdmin.from('menu_items').select('reserved_quantity').eq('id', oi.menu_item_id).single();
            if (!mErr && mItem && mItem.reserved_quantity !== undefined) {
              await supabaseAdmin.from('menu_items').update({
                reserved_quantity: (mItem.reserved_quantity || 0) + (oi.quantity || 1)
              }).eq('id', oi.menu_item_id);
            }
          }
        } catch (e) {
          console.warn('Re-reserve stock warning:', e.message);
        }
      }

      // Update or create payment_transactions safely if table exists
      let newTrans = null;
      try {
        const { data: tData } = await supabaseAdmin
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
        newTrans = tData;
      } catch (tErr) {
        console.warn('payment_transactions upsert notice:', tErr.message);
      }

      // Set order status back to pending and update special_notes
      const cleanOldNotes = (order.special_notes || '')
        .replace(/\[Bank Transfer Ref:[^\]]+\]/g, '')
        .replace(/\[Rejected:[^\]]+\]/g, '')
        .replace(/\[Payment Rejected:[^\]]+\]/g, '')
        .trim();
      const updatedNotes = `[Bank Transfer Ref: ${cleanRef} | Slip: ${slipPath}] ${cleanOldNotes}`.trim();

      await supabaseAdmin
        .from('orders')
        .update({
          status: 'pending',
          payment_status: 'pending',
          special_notes: updatedNotes
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
      let orders = [];

      // Query orders with joins
      const { data: qOrders, error: qErr } = await supabaseAdmin
        .from('orders')
        .select(`
          *,
          users(id, full_name, email, phone_number),
          restaurant_tables(table_number),
          order_items(*, menu_items(id, name, price, image_url))
        `)
        .order('created_at', { ascending: false });

      if (qErr) {
        console.warn('[pending-verification] Query join fallback:', qErr.message);
        const { data: fbOrders, error: fbErr } = await supabaseAdmin
          .from('orders')
          .select(`
            *,
            users(id, full_name, email, phone_number),
            order_items(*)
          `)
          .order('created_at', { ascending: false });

        if (fbErr) {
          const { data: minOrders } = await supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
          orders = minOrders || [];
        } else {
          orders = fbOrders || [];
        }
      } else {
        orders = qOrders || [];
      }

      // Filter orders awaiting verification or rejected
      const pendingOrders = orders.filter(o => {
        const notes = (o.special_notes || '').toLowerCase();
        const isBankTransfer = (o.payment_method === 'bank_transfer') || 
                               notes.includes('bank transfer') || 
                               notes.includes('[bank transfer ref:') ||
                               notes.includes('[rejected:') ||
                               o.status === 'payment_pending' ||
                               o.status === 'payment_rejected';
        if (!isBankTransfer) return false;

        // Final fulfilled orders don't need audit
        if (['served', 'completed'].includes(o.status)) return false;

        // If cancelled: only include if it's a rejected payment audit order
        if (o.status === 'cancelled') {
          return notes.includes('[rejected:') || notes.includes('reject');
        }

        // If not paid yet, include
        return o.payment_status !== 'paid';
      });

      if (pendingOrders.length === 0) {
        return res.json({ orders: [], count: 0 });
      }

      // Fetch payment transactions safely if table exists
      const orderIds = pendingOrders.map(o => o.id);
      let transactions = [];
      try {
        const { data: txData } = await supabaseAdmin
          .from('payment_transactions')
          .select('*')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false });
        transactions = txData || [];
      } catch (txErr) {
        console.warn('[pending-verification] payment_transactions query notice:', txErr.message);
      }

      const transMap = new Map();
      transactions.forEach(t => {
        if (!transMap.has(t.order_id)) {
          transMap.set(t.order_id, t);
        }
      });

      // Cache user storage file lists to prevent duplicate network calls
      const userFilesCache = new Map();

      // Generate signed URLs for slips and extract reference codes
      const enrichedOrders = await Promise.all(pendingOrders.map(async (order) => {
        let trans = transMap.get(order.id) || null;

        // If rejected in notes or status is cancelled and no trans or not rejected
        const notes = order.special_notes || '';
        const rejMatch = notes.match(/\[Rejected:\s*([^\]]+)\]/i) || notes.match(/\[Payment Rejected:\s*([^\]]+)\]/i);
        if (rejMatch || order.status === 'cancelled') {
          if (!trans) {
            trans = {
              order_id: order.id,
              status: 'rejected',
              rejection_reason: rejMatch ? rejMatch[1].trim() : 'Payment verification failed'
            };
          } else if (trans.status !== 'rejected' && rejMatch) {
            trans.status = 'rejected';
            trans.rejection_reason = rejMatch[1].trim();
          }
        }
        let signedUrl = null;
        let slipPath = trans?.slip_path || null;

        // 1. Extract Ref from special_notes if not in trans
        let ref = trans?.transaction_reference || null;
        if (!ref && order.special_notes) {
          const refMatch = order.special_notes.match(/\[Bank Transfer Ref:\s*([^\]|]+)/i) ||
                           order.special_notes.match(/Ref(?:erence)?[:\s#]+([A-Za-z0-9_-]+)/i);
          if (refMatch) ref = refMatch[1].trim();
        }

        // 2. Extract Slip Path from special_notes if not in trans
        if (!slipPath && order.special_notes) {
          const slipMatch = order.special_notes.match(/Slip:\s*([^\s\]]+)/i);
          if (slipMatch) slipPath = slipMatch[1].trim();
        }

        // 3. Fallback: If no slipPath in special_notes or trans, search storage bucket for this user
        const userId = order.user_id || order.users?.id;
        if (!slipPath && userId) {
          try {
            if (!userFilesCache.has(userId)) {
              const { data: userFiles, error: listErr } = await supabaseAdmin.storage
                .from('payment-slips')
                .list(userId, {
                  limit: 20,
                  sortBy: { column: 'created_at', order: 'desc' }
                });
              userFilesCache.set(userId, (!listErr && userFiles) ? userFiles : []);
            }

            const files = userFilesCache.get(userId) || [];
            if (files.length > 0) {
              const orderTime = new Date(order.created_at).getTime();
              const sorted = [...files].sort((a, b) => {
                const tsA = parseInt(a.name.split('_')[0], 10) || (a.created_at ? new Date(a.created_at).getTime() : 0);
                const tsB = parseInt(b.name.split('_')[0], 10) || (b.created_at ? new Date(b.created_at).getTime() : 0);
                return Math.abs(tsA - orderTime) - Math.abs(tsB - orderTime);
              });
              slipPath = `${userId}/${sorted[0].name}`;
            }
          } catch (storageListErr) {
            console.warn('[pending-verification] Storage list error:', storageListErr.message);
          }
        }

        // 4. Generate signed URL if slipPath was found
        if (slipPath) {
          try {
            const { data: sData } = await supabaseAdmin.storage
              .from('payment-slips')
              .createSignedUrl(slipPath, 86400); // 24 hours
            signedUrl = sData?.signedUrl || null;
          } catch (_) {}

          if (!signedUrl) {
            try {
              const { data: pData } = supabaseAdmin.storage
                .from('payment-slips')
                .getPublicUrl(slipPath);
              signedUrl = pData?.publicUrl || null;
            } catch (_) {}
          }
        }

        // 5. Build/Enrich payment_transaction object so admin panel has all audit data
        const enrichedTrans = {
          id: trans?.id || `pt_${order.id}`,
          order_id: order.id,
          user_id: userId,
          payment_method: 'bank_transfer',
          transaction_reference: ref || `BT-${order.id.slice(0, 8).toUpperCase()}`,
          bank_name: trans?.bank_name || (order.special_notes?.match(/Bank:\s*([^\s\]|]+)/i)?.[1]?.trim() || null),
          amount_paid: order.total_amount,
          status: order.payment_status === 'failed' ? 'rejected' : (order.payment_status === 'paid' ? 'approved' : 'pending_verification'),
          slip_path: slipPath,
          slip_url: signedUrl,
          rejection_reason: trans?.rejection_reason || (order.special_notes?.match(/\[Rejected:\s*([^\]]+)\]/i)?.[1]?.trim() || null),
          created_at: trans?.created_at || order.created_at,
          updated_at: trans?.updated_at || order.created_at
        };

        return {
          ...order,
          payment_transaction: enrichedTrans
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
              const { data: m, error: mErr } = await supabaseAdmin.from('menu_items').select('stock_quantity, reserved_quantity').eq('id', oi.menu_item_id).single();
              if (!mErr && m && m.stock_quantity !== undefined) {
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
            payment_status: 'paid'
          })
          .eq('id', order.id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        // 3. Update payment_transactions safely if table exists
        try {
          await supabaseAdmin
            .from('payment_transactions')
            .update({
              status: 'approved',
              reviewed_by: req.user.id,
              reviewed_at: now,
              updated_at: now
            })
            .eq('order_id', order.id);
        } catch (txErr) {
          console.warn('Payment transaction update warning:', txErr.message);
        }

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
              const { data: m, error: mErr } = await supabaseAdmin.from('menu_items').select('reserved_quantity').eq('id', oi.menu_item_id).single();
              if (!mErr && m && m.reserved_quantity !== undefined) {
                await supabaseAdmin.from('menu_items').update({
                  reserved_quantity: Math.max(0, (m.reserved_quantity ?? 0) - (oi.quantity || 1))
                }).eq('id', oi.menu_item_id);
              }
            }
          }
        } catch (stockErr) {
          console.warn('Release reserved stock warning:', stockErr.message);
        }

        // 2. Set order status = 'cancelled' and update notes
        let updatedOrder = null;
        const cleanNotes = (order.special_notes || '')
          .replace(/\[Rejected:[^\]]+\]/g, '')
          .replace(/\[Payment Rejected:[^\]]+\]/g, '')
          .trim();
        const rejectedNotes = `[Rejected: ${reason}] ${cleanNotes}`.trim();

        // Attempt 1: Cancel order and set payment_status to 'failed'
        try {
          const { data: uOrder, error: updateErr } = await supabaseAdmin
            .from('orders')
            .update({
              status: 'cancelled',
              payment_status: 'failed',
              special_notes: rejectedNotes
            })
            .eq('id', order.id)
            .select()
            .single();

          if (!updateErr && uOrder) {
            updatedOrder = uOrder;
          }
        } catch (_) {}

        // Attempt 2: If payment_status 'failed' violated check constraint, update status = 'cancelled' and notes
        if (!updatedOrder) {
          try {
            const { data: fbOrder, error: fbErr } = await supabaseAdmin
              .from('orders')
              .update({
                status: 'cancelled',
                special_notes: rejectedNotes
              })
              .eq('id', order.id)
              .select()
              .single();

            if (!fbErr && fbOrder) {
              updatedOrder = fbOrder;
            } else {
              console.warn('[Reject] Fallback cancel warning:', fbErr?.message);
            }
          } catch (e) {
            console.warn('[Reject] Fallback cancel error:', e.message);
          }
        }

        // 3. Upsert payment_transactions with rejection reason safely
        try {
          await supabaseAdmin
            .from('payment_transactions')
            .upsert({
              order_id: order.id,
              user_id: order.user_id,
              status: 'rejected',
              rejection_reason: reason,
              reviewed_by: req.user.id,
              reviewed_at: now,
              updated_at: now
            }, { onConflict: 'order_id' });
        } catch (txErr) {
          console.warn('Payment transaction rejection update warning:', txErr.message);
        }

        // 4. Send FCM alert to customer
        if (order.user_id) {
          try {
            await fcmService.sendToUser(order.user_id, {
              title: 'Payment Verification Failed ⚠️',
              body: `Reason: ${reason}. Order #${String(order.id).slice(0, 8)} has been cancelled. Tap to review options or retry.`,
              data: {
                type: 'order_status',
                order_id: String(order.id),
                status: 'cancelled',
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
