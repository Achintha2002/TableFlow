-- ==============================================================================
-- TableFlow: Bank Transfer & Payment Verification Workflow Migration
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/azjjndqecpemltvdbkvy/sql
-- ==============================================================================

-- 1. Create Private Storage Bucket for Payment Slips (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-slips',
    'payment-slips',
    false,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE 
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 2. Add Stock and Reservation Columns to menu_items
ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT 100,
    ADD COLUMN IF NOT EXISTS reserved_quantity INT DEFAULT 0;

-- 3. Payment Transactions Table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
    slip_path TEXT NOT NULL,
    transaction_reference TEXT NOT NULL,
    bank_name TEXT,
    amount_paid NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_verification' 
        CHECK (status IN ('pending_verification', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_transaction_reference UNIQUE (transaction_reference)
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON public.payment_transactions(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON public.payment_transactions(created_at DESC);

-- 4. Enable Row Level Security (RLS) on payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can insert own payment transactions" ON public.payment_transactions;
CREATE POLICY "Customers can insert own payment transactions"
    ON public.payment_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own payment transactions"
    ON public.payment_transactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can view and manage all payment transactions" ON public.payment_transactions;
CREATE POLICY "Staff can view and manage all payment transactions"
    ON public.payment_transactions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'manager', 'cashier', 'staff')
        )
    );

DROP POLICY IF EXISTS "Service role full access to payment_transactions" ON public.payment_transactions;
CREATE POLICY "Service role full access to payment_transactions"
    ON public.payment_transactions FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Storage RLS Policies for payment-slips Bucket
DROP POLICY IF EXISTS "Authenticated users can upload payment slips" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment slips"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'payment-slips' AND (auth.role() = 'authenticated' OR auth.role() = 'anon'));

DROP POLICY IF EXISTS "Staff and owners can view payment slips" ON storage.objects;
CREATE POLICY "Staff and owners can view payment slips"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'payment-slips' AND (
            EXISTS (
                SELECT 1 FROM public.users
                WHERE users.id = auth.uid()
                AND users.role IN ('admin', 'manager', 'cashier', 'staff')
            )
            OR (storage.foldername(name))[1] = auth.uid()::text
        )
    );

-- 6. Atomic Inventory Reservation Procedures

-- A. Reserve Inventory (Row-level lock with FOR UPDATE)
CREATE OR REPLACE FUNCTION public.reserve_inventory_for_order(
    p_order_id BIGINT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item RECORD;
    v_menu_id BIGINT;
    v_qty INT;
    v_stock INT;
    v_reserved INT;
    v_item_name TEXT;
BEGIN
    -- Iterate through each item requested
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_id := (item.value->>'menu_item_id')::BIGINT;
        v_qty := COALESCE((item.value->>'quantity')::INT, 1);

        -- Lock the row to prevent race conditions
        SELECT name, COALESCE(stock_quantity, 100), COALESCE(reserved_quantity, 0)
        INTO v_item_name, v_stock, v_reserved
        FROM public.menu_items
        WHERE id = v_menu_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Menu item ID % not found', v_menu_id;
        END IF;

        -- Check available stock (stock_quantity - reserved_quantity)
        IF (v_stock - v_reserved) < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %', 
                v_item_name, v_qty, (v_stock - v_reserved);
        END IF;

        -- Reserve quantity
        UPDATE public.menu_items
        SET reserved_quantity = COALESCE(reserved_quantity, 0) + v_qty
        WHERE id = v_menu_id;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Inventory reserved successfully');
END;
$$;

-- B. Commit Reserved Stock (Permanent deduction upon Admin Approval)
CREATE OR REPLACE FUNCTION public.commit_reserved_stock(
    p_order_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    oi RECORD;
BEGIN
    FOR oi IN 
        SELECT menu_item_id, quantity 
        FROM public.order_items 
        WHERE order_id = p_order_id
    LOOP
        UPDATE public.menu_items
        SET 
            stock_quantity = GREATEST(0, COALESCE(stock_quantity, 100) - oi.quantity),
            reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - oi.quantity)
        WHERE id = oi.menu_item_id;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Reserved inventory committed to permanent stock');
END;
$$;

-- C. Release Reserved Stock (Upon rejection, cancellation, or 24h auto-expiry)
CREATE OR REPLACE FUNCTION public.release_reserved_stock(
    p_order_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    oi RECORD;
BEGIN
    FOR oi IN 
        SELECT menu_item_id, quantity 
        FROM public.order_items 
        WHERE order_id = p_order_id
    LOOP
        UPDATE public.menu_items
        SET 
            reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - oi.quantity)
        WHERE id = oi.menu_item_id;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Reserved inventory successfully released');
END;
$$;

-- 7. Add comments for database documentation
COMMENT ON TABLE public.payment_transactions IS 'Stores audit logs and proof of manual payments (e.g. Bank Transfers) awaiting admin verification.';
COMMENT ON COLUMN public.payment_transactions.slip_path IS 'Storage path inside private payment-slips bucket.';
COMMENT ON COLUMN public.payment_transactions.transaction_reference IS 'Unique bank transaction reference code supplied by customer.';
