-- ==============================================================================
-- TableFlow: Voucher Broadcasts & Distribution Audit Log Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/azjjndqecpemltvdbkvy/sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.voucher_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code TEXT REFERENCES public.coupons(code) ON DELETE CASCADE,
  sent_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,            -- 'all' | 'selected' | 'tier'
  target_tier TEXT,                     -- 'Bronze' | 'Silver' | 'Gold'
  recipients_count INT NOT NULL DEFAULT 0,
  wallet_added_count INT NOT NULL DEFAULT 0,
  already_had_count INT NOT NULL DEFAULT 0,
  push_sent_count INT NOT NULL DEFAULT 0,
  push_failed_count INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy queries on broadcasts
CREATE INDEX IF NOT EXISTS idx_voucher_broadcasts_code ON public.voucher_broadcasts(coupon_code);
CREATE INDEX IF NOT EXISTS idx_voucher_broadcasts_created ON public.voucher_broadcasts(created_at DESC);

-- Enable RLS
ALTER TABLE public.voucher_broadcasts ENABLE ROW LEVEL SECURITY;

-- Policies: Admin/Manager can view broadcasts
DROP POLICY IF EXISTS "Admin/Manager view broadcasts" ON public.voucher_broadcasts;
CREATE POLICY "Admin/Manager view broadcasts" ON public.voucher_broadcasts 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- Backend service role has full access
DROP POLICY IF EXISTS "Service role manage voucher_broadcasts" ON public.voucher_broadcasts;
CREATE POLICY "Service role manage voucher_broadcasts" ON public.voucher_broadcasts 
  FOR ALL USING (true) WITH CHECK (true);
