ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS special_requests TEXT,
ADD COLUMN IF NOT EXISTS admin_reply TEXT;
