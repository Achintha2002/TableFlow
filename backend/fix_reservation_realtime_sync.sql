-- ==============================================================
-- TableFlow: Enable Live Realtime Sync & Availability for Tables
-- Execute this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================

-- 1. Helper function for role checking if not exists
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM users WHERE id = auth.uid();
$$;

-- 2. Ensure anyone (authenticated or anon) can SELECT reservations
-- This is strictly required so that:
-- a) User B can check whether Table 1 is reserved on a given date/time
-- b) Supabase Realtime broadcasts reservation inserts/updates to all users' devices
DROP POLICY IF EXISTS "Users can view own reservations" ON reservations;
DROP POLICY IF EXISTS "Allow reading reservations for table availability" ON reservations;
DROP POLICY IF EXISTS "Admins and Managers full access to reservations" ON reservations;
DROP POLICY IF EXISTS "Admins full access to reservations" ON reservations;

-- Allow reading all reservations for availability calculation & realtime sync
CREATE POLICY "Allow reading reservations for table availability" 
ON reservations FOR SELECT 
USING (true);

-- Allow authenticated users to insert their own reservations
DROP POLICY IF EXISTS "Users can insert own reservations" ON reservations;
CREATE POLICY "Users can insert own reservations" 
ON reservations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own reservations (e.g., cancel)
DROP POLICY IF EXISTS "Users can cancel own reservations" ON reservations;
CREATE POLICY "Users can cancel own reservations" 
ON reservations FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow Admins and Managers full management access (all operations)
CREATE POLICY "Admins and Managers full access to reservations" 
ON reservations FOR ALL 
USING (get_my_role() IN ('admin', 'manager'));

-- 3. Ensure table categories & restaurant_tables are readable by everyone
DROP POLICY IF EXISTS "Anyone can view tables" ON restaurant_tables;
CREATE POLICY "Anyone can view tables" 
ON restaurant_tables FOR SELECT 
USING (true);

-- 4. Automatic Realtime Sync Trigger with SECURITY DEFINER
-- Runs with database superuser/definer rights, bypassing RLS so that when ANY customer
-- books a table for today, restaurant_tables status is automatically updated!
CREATE OR REPLACE FUNCTION sync_table_reservation_status()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.table_id IS NOT NULL AND NEW.reservation_date = CURRENT_DATE THEN
            IF NEW.status::text IN ('confirmed', 'pending') THEN
                UPDATE public.restaurant_tables 
                SET status = 'reserved' 
                WHERE id = NEW.table_id AND status = 'available';
            ELSIF NEW.status::text = 'cancelled' THEN
                -- If this was the only active reservation for today, return to available
                IF NOT EXISTS (
                    SELECT 1 FROM public.reservations 
                    WHERE table_id = NEW.table_id 
                      AND reservation_date = CURRENT_DATE 
                      AND status::text IN ('confirmed', 'pending')
                      AND id != NEW.id
                ) THEN
                    UPDATE public.restaurant_tables 
                    SET status = 'available' 
                    WHERE id = NEW.table_id AND status = 'reserved';
                END IF;
            ELSIF NEW.status::text = 'completed' THEN
                UPDATE public.restaurant_tables 
                SET status = 'occupied' 
                WHERE id = NEW.table_id;
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.table_id IS NOT NULL AND OLD.reservation_date = CURRENT_DATE THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.reservations 
                WHERE table_id = OLD.table_id 
                  AND reservation_date = CURRENT_DATE 
                  AND status::text IN ('confirmed', 'pending')
                  AND id != OLD.id
            ) THEN
                UPDATE public.restaurant_tables 
                SET status = 'available' 
                WHERE id = OLD.table_id AND status = 'reserved';
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_table_reservation_status ON public.reservations;
CREATE TRIGGER trg_sync_table_reservation_status
AFTER INSERT OR UPDATE OR DELETE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION sync_table_reservation_status();

-- 5. Enable Supabase Realtime publication & Full Replica Identity
ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER TABLE public.restaurant_tables REPLICA IDENTITY FULL;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
