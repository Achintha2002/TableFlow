-- ==============================================================
-- TableFlow: Enforce Maximum 2 Active Reservations Per User
-- Execute this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================

CREATE OR REPLACE FUNCTION check_max_active_reservations()
RETURNS TRIGGER AS $$
DECLARE
    active_count INT;
BEGIN
    -- Only check for active reservations (pending, confirmed, seated) on or after today
    IF NEW.status IN ('confirmed', 'pending', 'seated') AND NEW.reservation_date >= CURRENT_DATE THEN
        SELECT COUNT(*)
        INTO active_count
        FROM public.reservations
        WHERE user_id = NEW.user_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND status IN ('confirmed', 'pending', 'seated')
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
