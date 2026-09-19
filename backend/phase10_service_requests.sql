-- ==============================================================================
-- TableFlow Phase 10: Waiter Floor Mode & Service Requests Schema
-- ==============================================================================

-- 1. Service Requests Table
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id BIGINT NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('water', 'waiter', 'bill', 'cutlery', 'cleanup', 'general')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attended', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    attended_at TIMESTAMPTZ DEFAULT NULL,
    attended_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_requests_table_status ON public.service_requests(table_id, status);
CREATE INDEX IF NOT EXISTS idx_service_requests_status_created ON public.service_requests(status, created_at DESC);

-- 2. Audit Trail for Table Status Changes
ALTER TABLE public.restaurant_tables
    ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Audit Trail for Staff Order Punch-in
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. Row Level Security (RLS)
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Customers can insert service requests for tables
DROP POLICY IF EXISTS "Customers can create service requests" ON public.service_requests;
CREATE POLICY "Customers can create service requests"
    ON public.service_requests FOR INSERT
    WITH CHECK (true);

-- Customers can view their own requests
DROP POLICY IF EXISTS "Users can view own service requests" ON public.service_requests;
CREATE POLICY "Users can view own service requests"
    ON public.service_requests FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Staff and Admins full access
DROP POLICY IF EXISTS "Staff can manage all service requests" ON public.service_requests;
CREATE POLICY "Staff can manage all service requests"
    ON public.service_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('staff', 'waiter', 'manager', 'admin')
        )
    );

DROP POLICY IF EXISTS "Service role full access to service_requests" ON public.service_requests;
CREATE POLICY "Service role full access to service_requests"
    ON public.service_requests FOR ALL
    USING (true)
    WITH CHECK (true);
