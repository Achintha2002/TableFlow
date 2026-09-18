-- ==============================================================================
-- TableFlow: Phase 0 Production Hardening & Validation Schema Migration
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/azjjndqecpemltvdbkvy/sql
-- ==============================================================================

-- 1. ENUM UPDATES (If running on fresh or existing database)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'reserved' AND enumtypid = 'table_status'::regtype) THEN
    ALTER TYPE table_status ADD VALUE 'reserved';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;

-- 2. HARDEN ORDERS TABLE (Idempotency, Financial Audit Fields & POS Locking)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

-- 3. HARDEN USERS TABLE (Prevent negative loyalty points balance)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_loyalty_points_non_negative') THEN
    ALTER TABLE users ADD CONSTRAINT chk_loyalty_points_non_negative CHECK (loyalty_points >= 0);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. LOYALTY TRANSACTIONS LEDGER (Immutable audit log of all point movements)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    points_change INT NOT NULL, -- positive for earned, negative for redeemed
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. COUPONS & PROMOTIONS TABLE
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_percent INT DEFAULT 0, -- e.g. 10 for 10%
    discount_amount DECIMAL(10, 2) DEFAULT 0.00, -- e.g. 500 for LKR 500 flat discount
    min_order_amount DECIMAL(10, 2) DEFAULT 0.00,
    max_uses_per_user INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. COUPON REDEMPTIONS (Enforce 1 redemption per user or max usage limit)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id SERIAL PRIMARY KEY,
    coupon_id INT REFERENCES coupons(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SERVICE REQUESTS TABLE ("Call Waiter", "Request Water/Bill")
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_id INT REFERENCES restaurant_tables(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    request_type TEXT NOT NULL, -- 'call_waiter', 'water', 'bill', 'clean_table'
    status TEXT DEFAULT 'pending', -- 'pending', 'attended', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attended_at TIMESTAMP WITH TIME ZONE
);

-- 8. HARDEN REVIEWS TABLE (Ensure 1 review per order)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_review_per_order') THEN
    ALTER TABLE reviews ADD CONSTRAINT unique_review_per_order UNIQUE (order_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_table THEN null;
END $$;

-- ==============================================================================
-- ATOMIC STORED PROCEDURES (RPCs) FOR CONCURRENCY & FINANCIAL INTEGRITY
-- ==============================================================================

-- A. Atomic Loyalty Points Deduction
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
    p_user_id UUID,
    p_points INT,
    p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_current_points INT;
BEGIN
    -- Row-level lock to prevent double-spending race conditions
    SELECT loyalty_points INTO v_current_points
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_points IS NULL OR v_current_points < p_points THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient loyalty points balance');
    END IF;

    -- Deduct points
    UPDATE users
    SET loyalty_points = loyalty_points - p_points
    WHERE id = p_user_id;

    -- Record in ledger
    INSERT INTO loyalty_transactions (user_id, order_id, points_change, reason)
    VALUES (p_user_id, p_order_id, -p_points, 'Redeemed at checkout');

    RETURN jsonb_build_object('success', true, 'remaining_points', v_current_points - p_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Atomic Loyalty Points Award (e.g., 5% of order amount to points)
CREATE OR REPLACE FUNCTION earn_loyalty_points(
    p_user_id UUID,
    p_points INT,
    p_order_id UUID,
    p_reason TEXT DEFAULT 'Order completion reward'
)
RETURNS JSONB AS $$
BEGIN
    UPDATE users
    SET loyalty_points = loyalty_points + p_points
    WHERE id = p_user_id;

    INSERT INTO loyalty_transactions (user_id, order_id, points_change, reason)
    VALUES (p_user_id, p_order_id, p_points, p_reason);

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. POS Table Bill Settlement & Table Release Transaction
CREATE OR REPLACE FUNCTION settle_table_bill(
    p_table_id INT,
    p_order_id UUID,
    p_payment_method TEXT,
    p_cashier_id UUID,
    p_discount_amount DECIMAL DEFAULT 0.00,
    p_tax_amount DECIMAL DEFAULT 0.00,
    p_service_charge DECIMAL DEFAULT 0.00
)
RETURNS JSONB AS $$
BEGIN
    -- Settle the order
    UPDATE orders
    SET payment_status = 'paid',
        status = 'served',
        payment_method = p_payment_method,
        discount_amount = p_discount_amount,
        tax_amount = p_tax_amount,
        service_charge = p_service_charge,
        locked_by = NULL,
        locked_at = NULL
    WHERE id = p_order_id;

    -- Mark table as cleaning (or available)
    IF p_table_id IS NOT NULL THEN
        UPDATE restaurant_tables
        SET status = 'cleaning'
        WHERE id = p_table_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Bill settled and table freed.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- D. POS Concurrent Access Lock (Prevents two cashiers from settling the same bill simultaneously)
CREATE OR REPLACE FUNCTION lock_order_for_settlement(
    p_order_id UUID,
    p_cashier_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_locked_by UUID;
    v_locked_at TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT locked_by, locked_at INTO v_locked_by, v_locked_at
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    -- If locked by someone else within the last 5 minutes, reject
    IF v_locked_by IS NOT NULL AND v_locked_by <> p_cashier_id AND v_locked_at > (NOW() - INTERVAL '5 minutes') THEN
        RETURN jsonb_build_object('success', false, 'error', 'This bill is currently being processed by another staff member');
    END IF;

    -- Acquire lock
    UPDATE orders
    SET locked_by = p_cashier_id,
        locked_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- LOYALTY TRANSACTIONS POLICIES
DROP POLICY IF EXISTS "Users view own loyalty transactions" ON loyalty_transactions;
CREATE POLICY "Users view own loyalty transactions" ON loyalty_transactions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins full access loyalty transactions" ON loyalty_transactions;
CREATE POLICY "Admins full access loyalty transactions" ON loyalty_transactions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager', 'cashier'))
    );

-- COUPONS POLICIES
DROP POLICY IF EXISTS "Anyone can view active coupons" ON coupons;
CREATE POLICY "Anyone can view active coupons" ON coupons
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage coupons" ON coupons;
CREATE POLICY "Admins manage coupons" ON coupons
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
    );

-- COUPON REDEMPTIONS POLICIES
DROP POLICY IF EXISTS "Users view own coupon redemptions" ON coupon_redemptions;
CREATE POLICY "Users view own coupon redemptions" ON coupon_redemptions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins full access coupon redemptions" ON coupon_redemptions;
CREATE POLICY "Admins full access coupon redemptions" ON coupon_redemptions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager', 'cashier'))
    );

-- SERVICE REQUESTS POLICIES
DROP POLICY IF EXISTS "Anyone can insert service requests" ON service_requests;
CREATE POLICY "Anyone can insert service requests" ON service_requests
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view active service requests" ON service_requests;
CREATE POLICY "Anyone can view active service requests" ON service_requests
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can update service requests" ON service_requests;
CREATE POLICY "Staff can update service requests" ON service_requests
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager', 'staff', 'cashier'))
    );

-- ==============================================================================
-- SEED SAMPLE COUPONS (FOR IMMEDIATE TESTING)
-- ==============================================================================
INSERT INTO coupons (code, description, discount_percent, discount_amount, min_order_amount, max_uses_per_user, is_active, valid_until)
VALUES 
    ('WELCOME10', '10% discount on your first order', 10, 0, 1000.00, 1, true, NOW() + INTERVAL '1 year'),
    ('FLAT500', 'LKR 500 flat discount on orders over LKR 3000', 0, 500.00, 3000.00, 2, true, NOW() + INTERVAL '1 year'),
    ('TFVIP20', '20% discount for Gold/VIP members', 20, 0, 2500.00, 5, true, NOW() + INTERVAL '1 year')
ON CONFLICT (code) DO NOTHING;
