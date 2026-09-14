-- Step 1: Add queue_date and queue_number to queue_entries
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS queue_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS queue_number INTEGER;

-- Step 2: Create a function to auto-assign queue_number per day
CREATE OR REPLACE FUNCTION assign_daily_queue_number()
RETURNS TRIGGER AS $$
BEGIN
    -- If queue_number is not provided, calculate the next one for the given queue_date
    IF NEW.queue_number IS NULL THEN
        SELECT COALESCE(MAX(queue_number), 0) + 1 
        INTO NEW.queue_number
        FROM queue_entries
        WHERE queue_date = NEW.queue_date;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a trigger that calls the function before insert
DROP TRIGGER IF EXISTS trigger_assign_daily_queue_number ON queue_entries;
CREATE TRIGGER trigger_assign_daily_queue_number
BEFORE INSERT ON queue_entries
FOR EACH ROW
EXECUTE FUNCTION assign_daily_queue_number();

-- Step 4: Backfill existing data if any (safeguard)
DO $$
DECLARE
    rec RECORD;
    counter INTEGER := 1;
BEGIN
    FOR rec IN SELECT id FROM queue_entries WHERE queue_number IS NULL ORDER BY joined_at ASC LOOP
        UPDATE queue_entries SET queue_number = counter WHERE id = rec.id;
        counter := counter + 1;
    END LOOP;
END $$;
