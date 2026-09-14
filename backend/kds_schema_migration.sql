-- ==============================================================================
-- KDS (Kitchen Display System) Schema Updates
-- Run this script in the Supabase SQL Editor
-- ==============================================================================

-- 1. Add new columns to `orders` table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES reservations(id),
  ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES restaurant_tables(id),
  ADD COLUMN IF NOT EXISTS target_serve_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS special_notes TEXT;

-- 2. Add prep_time_minutes to `menu_items` table
ALTER TABLE menu_items 
  ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER DEFAULT 15;

-- 3. Add item_notes to `order_items` table
ALTER TABLE order_items 
  ADD COLUMN IF NOT EXISTS item_notes TEXT;

-- 4. Enable Supabase Realtime for `orders` and `order_items`
-- Ensure that these tables are included in the 'supabase_realtime' publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'order_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    END IF;
END
$$;

-- 5. Add RLS Policies for Kitchen Role
-- Note: Re-run these even if they exist to ensure kitchen staff has access.
DO $$
BEGIN
    -- Policy for viewing orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Kitchen can view orders'
    ) THEN
        CREATE POLICY "Kitchen can view orders" ON orders 
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() AND users.role IN ('kitchen','manager','admin')
          )
        );
    END IF;

    -- Policy for updating orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Kitchen can update order status'
    ) THEN
        CREATE POLICY "Kitchen can update order status" ON orders 
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() AND users.role IN ('kitchen','manager','admin')
          )
        );
    END IF;
END
$$;
