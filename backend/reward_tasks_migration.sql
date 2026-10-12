-- ==============================================================================
-- TableFlow: Master Gamified Reward Tasks & Challenges Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/azjjndqecpemltvdbkvy/sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.reward_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_type TEXT NOT NULL DEFAULT 'restaurant',   -- 'restaurant' | 'calendar' | 'flame' | 'star' | 'award' | 'coffee'
  target_progress INT NOT NULL DEFAULT 1,
  reward_discount_percent INT NOT NULL DEFAULT 10,
  trigger_type TEXT NOT NULL DEFAULT 'dine_in_orders', -- 'dine_in_orders' | 'weekday_booking' | 'chef_special' | 'min_spend' | 'custom_manual'
  trigger_value NUMERIC DEFAULT NULL,              -- e.g. min spend threshold if trigger_type = 'min_spend'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime replication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'reward_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reward_tasks;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_discount_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_discount_tasks;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Publication might already contain table or permission limitation
  NULL;
END $$;

-- Enable RLS
ALTER TABLE public.reward_tasks ENABLE ROW LEVEL SECURITY;

-- Everyone can view active reward tasks
DROP POLICY IF EXISTS "Public view active reward tasks" ON public.reward_tasks;
CREATE POLICY "Public view active reward tasks" ON public.reward_tasks
  FOR SELECT USING (true);

-- Admin/service role can manage all
DROP POLICY IF EXISTS "Service role manage reward_tasks" ON public.reward_tasks;
CREATE POLICY "Service role manage reward_tasks" ON public.reward_tasks
  FOR ALL USING (true) WITH CHECK (true);

-- Seed default initial tasks
INSERT INTO public.reward_tasks (task_key, title, description, icon_type, target_progress, reward_discount_percent, trigger_type, is_active)
VALUES
  ('dine_3_orders', 'Dine-In Explorer', 'Complete 3 served dine-in meals at TableFlow to unlock 10% OFF.', 'restaurant', 3, 10, 'dine_in_orders', true),
  ('weekday_booking', 'Weekday Gourmet', 'Book and complete a table reservation between Monday and Thursday.', 'calendar', 1, 10, 'weekday_booking', true),
  ('chef_special', 'Chef''s Signature Fan', 'Order any signature dish from our Chef''s Special menu.', 'flame', 1, 10, 'chef_special', true)
ON CONFLICT (task_key) DO NOTHING;
