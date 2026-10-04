-- ==============================================================
-- TableFlow: Enforce Max 2 Active Reservations & Live Table Sync
-- Execute this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================

-- 1. Max 2 active reservations per user account
CREATE OR REPLACE FUNCTION check_max_active_reservations()
RETURNS TRIGGER AS $$
DECLARE
    active_count INT;
BEGIN
    -- Only check for active reservations (pending, confirmed) on or after today
    IF NEW.status::text IN ('confirmed', 'pending') AND NEW.reservation_date >= CURRENT_DATE THEN
        SELECT COUNT(*)
        INTO active_count
        FROM public.reservations
        WHERE user_id = NEW.user_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND status::text IN ('confirmed', 'pending')
          AND reservation_date >= CURRENT_DATE;

        IF active_count >= 2 THEN
            RAISE EXCEPTION 'Maximum 2 active table reservations allowed per account. Please cancel or complete an existing booking before reserving another table.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_max_active_reservations ON public.reservations;

CREATE TRIGGER trg_check_max_active_reservations
BEFORE INSERT OR UPDATE OF status, reservation_date ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION check_max_active_reservations();


-- 2. Automatic Realtime Sync: Sync table status when reservation changes
CREATE OR REPLACE FUNCTION sync_table_reservation_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When a reservation is confirmed/pending for today, update table status to 'reserved'
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.table_id IS NOT NULL AND NEW.reservation_date = CURRENT_DATE THEN
            IF NEW.status::text IN ('confirmed', 'pending') THEN
                UPDATE public.restaurant_tables 
                SET status = 'reserved' 
                WHERE id = NEW.table_id AND status = 'available';
            ELSIF NEW.status::text = 'cancelled' THEN
                UPDATE public.restaurant_tables 
                SET status = 'available' 
                WHERE id = NEW.table_id AND status = 'reserved';
            ELSIF NEW.status::text = 'completed' THEN
                UPDATE public.restaurant_tables 
                SET status = 'occupied' 
                WHERE id = NEW.table_id;
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.table_id IS NOT NULL AND OLD.reservation_date = CURRENT_DATE THEN
            UPDATE public.restaurant_tables 
            SET status = 'available' 
            WHERE id = OLD.table_id AND status = 'reserved';
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


-- 3. Enable Supabase Realtime broadcast for live data transfer
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
