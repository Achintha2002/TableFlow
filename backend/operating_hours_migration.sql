-- ==============================================================================
-- TableFlow: Dynamic Operating Hours, Closures & Realtime Sync Migration
-- Timezone: Asia/Colombo (GMT+5:30)
-- ==============================================================================

-- 1. Main weekly operating hours configuration table
CREATE TABLE IF NOT EXISTS public.restaurant_operating_hours (
    id INT PRIMARY KEY DEFAULT 1,
    default_open_time TIME NOT NULL DEFAULT '08:00:00',
    default_close_time TIME NOT NULL DEFAULT '23:00:00',
    last_booking_minutes_before_close INT NOT NULL DEFAULT 60, -- default: 60 mins before closing -> 22:00
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT single_row_config CHECK (id = 1)
);

-- Seed initial default configuration row (08:00 to 23:00)
INSERT INTO public.restaurant_operating_hours (id, default_open_time, default_close_time, last_booking_minutes_before_close) 
VALUES (1, '08:00:00', '23:00:00', 60) 
ON CONFLICT (id) DO NOTHING;

-- 2. Closures table for holidays AND emergency "closed today"
CREATE TABLE IF NOT EXISTS public.restaurant_special_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    close_date DATE NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    is_full_day BOOLEAN NOT NULL DEFAULT TRUE,
    custom_open_time TIME DEFAULT NULL,
    custom_close_time TIME DEFAULT NULL,
    notified_customers BOOLEAN DEFAULT FALSE,
    created_by_emergency BOOLEAN DEFAULT FALSE, -- true = "Close Today" button, false = scheduled holiday
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Derived helper function using Sri Lanka timezone (Asia/Colombo)
CREATE OR REPLACE FUNCTION public.is_restaurant_open_today()
RETURNS BOOLEAN AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.restaurant_special_closures
    WHERE close_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Colombo')::DATE 
      AND is_full_day = true
  );
$$ LANGUAGE sql STABLE;

-- 4. Enable Supabase Realtime Broadcasting
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_operating_hours'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_operating_hours;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_special_closures'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_special_closures;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- 5. Row Level Security Policies
ALTER TABLE public.restaurant_operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_special_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read operating hours" ON public.restaurant_operating_hours;
CREATE POLICY "Public read operating hours" ON public.restaurant_operating_hours FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read closures" ON public.restaurant_special_closures;
CREATE POLICY "Public read closures" ON public.restaurant_special_closures FOR SELECT USING (true);

-- Admin / Manager update policies
DROP POLICY IF EXISTS "Admin update operating hours" ON public.restaurant_operating_hours;
CREATE POLICY "Admin update operating hours" ON public.restaurant_operating_hours FOR ALL USING (
    get_my_role() IN ('admin', 'manager')
);

-- 6. Server-Side Database Triggers for Strict Enforcement
CREATE OR REPLACE FUNCTION public.validate_reservation_operating_hours()
RETURNS TRIGGER AS $$
DECLARE
    v_open_time TIME;
    v_close_time TIME;
    v_cutoff_mins INT;
    v_last_booking TIME;
    v_closure RECORD;
BEGIN
    -- Check if date is in restaurant_special_closures
    SELECT * INTO v_closure 
    FROM public.restaurant_special_closures 
    WHERE close_date = NEW.reservation_date;

    IF FOUND AND v_closure.is_full_day THEN
        RAISE EXCEPTION 'Restaurant is closed on %: %', NEW.reservation_date, v_closure.reason;
    END IF;

    -- Fetch operating hours
    SELECT default_open_time, default_close_time, last_booking_minutes_before_close 
    INTO v_open_time, v_close_time, v_cutoff_mins
    FROM public.restaurant_operating_hours
    WHERE id = 1;

    IF v_open_time IS NULL THEN
        v_open_time := '08:00:00'::TIME;
        v_close_time := '23:00:00'::TIME;
        v_cutoff_mins := 60;
    END IF;

    v_last_booking := v_close_time - (v_cutoff_mins || ' minutes')::INTERVAL;

    IF NEW.reservation_time < v_open_time OR NEW.reservation_time > v_last_booking THEN
        RAISE EXCEPTION 'Reservation time % is outside operating hours (% to %)', 
            NEW.reservation_time, v_open_time, v_last_booking;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_reservation_hours ON public.reservations;
CREATE TRIGGER trg_validate_reservation_hours
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.validate_reservation_operating_hours();

-- Queue trigger: blocks joining queue if restaurant is closed today
CREATE OR REPLACE FUNCTION public.validate_queue_operating_hours()
RETURNS TRIGGER AS $$
DECLARE
    v_is_open BOOLEAN;
BEGIN
    SELECT public.is_restaurant_open_today() INTO v_is_open;
    IF NOT v_is_open THEN
        RAISE EXCEPTION 'Restaurant queue is closed today.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_queue_hours ON public.queue_entries;
CREATE TRIGGER trg_validate_queue_hours
BEFORE INSERT ON public.queue_entries
FOR EACH ROW
EXECUTE FUNCTION public.validate_queue_operating_hours();

