-- ==============================================================================
-- TableFlow: 30-Day Account Deletion (Soft-Delete) Schema Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/azjjndqecpemltvdbkvy/sql
-- ==============================================================================

-- 1. Add soft-delete tracking columns to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_pending_deletion BOOLEAN DEFAULT false;

-- 2. Performance index for the daily scheduled purge cron job
CREATE INDEX IF NOT EXISTS idx_users_pending_deletion 
ON public.users(is_pending_deletion, scheduled_deletion_at) 
WHERE is_pending_deletion = true;

-- 3. Ensure financial audit compliance: preserve orders and payment_transactions with NULL user_id on delete
DO $$
BEGIN
  -- If payment_transactions exists and has user_id foreign key, ensure it allows NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN user_id DROP NOT NULL;
  END IF;

  -- Ensure orders user_id allows NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
  END IF;

  -- Ensure reservations user_id allows NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.reservations ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;
