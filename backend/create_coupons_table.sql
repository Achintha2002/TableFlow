-- ==============================================================================
-- TableFlow: Create Coupons & Redemptions Tables
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/azjjndqecpemltvdbkvy/sql
-- ==============================================================================

-- 1. Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_percent INT DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    min_order_amount DECIMAL(10, 2) DEFAULT 0.00,
    max_uses_per_user INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create coupon redemptions table
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id SERIAL PRIMARY KEY,
    coupon_id INT REFERENCES public.coupons(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;
CREATE POLICY "Anyone can view active coupons" ON public.coupons 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons" ON public.coupons 
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow redemptions read" ON public.coupon_redemptions;
CREATE POLICY "Allow redemptions read" ON public.coupon_redemptions 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow redemptions insert" ON public.coupon_redemptions;
CREATE POLICY "Allow redemptions insert" ON public.coupon_redemptions 
    FOR INSERT WITH CHECK (true);

-- 5. Seed initial starter coupons
INSERT INTO public.coupons (code, description, discount_percent, discount_amount, min_order_amount, max_uses_per_user, is_active, valid_until)
VALUES 
    ('WELCOME10', '10% Welcome discount for new diners', 10, 0, 1000, 1, true, NOW() + INTERVAL '60 days'),
    ('TF-FEAST500', 'Flat LKR 500 discount on bills over LKR 3,500', 0, 500, 3500, 2, true, NOW() + INTERVAL '30 days')
ON CONFLICT (code) DO NOTHING;
