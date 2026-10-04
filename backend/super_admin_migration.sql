-- ==============================================================
-- TableFlow: Super Admin Role Migration
-- Execute this query in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================

DO $$
BEGIN
    -- Add 'super_admin' to user_role ENUM type if it exists
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;
