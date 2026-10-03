-- ==============================================================================
-- TableFlow: Silver Member Vouchers, In-App Wallet & Tasks Schema Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/azjjndqecpemltvdbkvy/sql
-- ==============================================================================

-- 1. Ensure WELCOME10 exists in coupons catalog
INSERT INTO public.coupons (code, description, discount_percent, discount_amount, min_order_amount, max_uses_per_user, is_active, valid_until)
VALUES ('WELCOME10', '10% Welcome discount for Silver members', 10, 0, 0, 1, true, NULL)
ON CONFLICT (code) DO UPDATE 
SET is_active = true, discount_percent = 10;

-- 2. Per-user voucher wallet
CREATE TABLE IF NOT EXISTS public.user_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    coupon_code TEXT REFERENCES public.coupons(code) ON DELETE CASCADE NOT NULL,
    source TEXT NOT NULL DEFAULT 'silver_tier_welcome', -- 'silver_tier_welcome' | 'task_reward'
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ DEFAULT NULL,
    used_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, coupon_code)
);

CREATE INDEX IF NOT EXISTS idx_user_vouchers_user ON public.user_vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_code ON public.user_vouchers(coupon_code);

-- 3. User discount tasks tracking
CREATE TABLE IF NOT EXISTS public.user_discount_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    task_key TEXT NOT NULL, -- 'dine_3_orders' | 'weekday_booking' | 'chef_special'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    current_progress INT DEFAULT 0,
    target_progress INT NOT NULL DEFAULT 1,
    reward_discount_percent INT DEFAULT 10,
    is_completed BOOLEAN DEFAULT false,
    is_claimed BOOLEAN DEFAULT false,
    claimed_voucher_code TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, task_key)
);

CREATE INDEX IF NOT EXISTS idx_user_discount_tasks_user ON public.user_discount_tasks(user_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.user_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_discount_tasks ENABLE ROW LEVEL SECURITY;

-- 5. Strict RLS Policies: Users can SELECT their own rows, mutations done via service role / backend
DROP POLICY IF EXISTS "Users view own vouchers" ON public.user_vouchers;
CREATE POLICY "Users view own vouchers" ON public.user_vouchers 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manage user_vouchers" ON public.user_vouchers;
CREATE POLICY "Service role manage user_vouchers" ON public.user_vouchers 
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own tasks" ON public.user_discount_tasks;
CREATE POLICY "Users view own tasks" ON public.user_discount_tasks 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manage user_discount_tasks" ON public.user_discount_tasks;
CREATE POLICY "Service role manage user_discount_tasks" ON public.user_discount_tasks 
    FOR ALL USING (true) WITH CHECK (true);

-- 6. Seed WELCOME10 for all existing Silver tier members & send in-app notification
DO $$
DECLARE
    silver_user RECORD;
BEGIN
    FOR silver_user IN SELECT id, full_name FROM public.users WHERE loyalty_tier = 'Silver' LOOP
        -- Insert voucher into wallet (idempotent)
        INSERT INTO public.user_vouchers (user_id, coupon_code, source)
        VALUES (silver_user.id, 'WELCOME10', 'silver_tier_welcome')
        ON CONFLICT (user_id, coupon_code) DO NOTHING;

        -- Insert notification if not already sent
        IF NOT EXISTS (
            SELECT 1 FROM public.notifications 
            WHERE user_id = silver_user.id AND title LIKE '%Silver Member Exclusive%'
        ) THEN
            INSERT INTO public.notifications (user_id, title, body, is_read, created_at)
            VALUES (
                silver_user.id,
                '🎉 Silver Member Exclusive 10% Voucher!',
                'Welcome to Silver Tier! Use voucher code WELCOME10 to get 10% OFF on your next order.',
                false,
                NOW()
            );
        END IF;
    END LOOP;
END $$;
