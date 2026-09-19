-- ==============================================================================
-- TableFlow Phase 9: Real FCM Push Notification & Multi-Device Infrastructure
-- ==============================================================================

-- 1. Multi-Device FCM Tokens Table
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL UNIQUE,
    platform TEXT DEFAULT 'web' CHECK (platform IN ('android', 'ios', 'web')),
    device_info TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_fcm_token ON public.user_devices(fcm_token);

-- 2. In-App Notifications History Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'order_ready', 'queue_ready', 'service_request', 'reservation_confirmed', 'payment_success')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications (user_id, is_read, created_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own registered devices
DROP POLICY IF EXISTS "Users can view their own devices" ON public.user_devices;
CREATE POLICY "Users can view their own devices"
    ON public.user_devices FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own devices" ON public.user_devices;
CREATE POLICY "Users can insert their own devices"
    ON public.user_devices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own devices" ON public.user_devices;
CREATE POLICY "Users can delete their own devices"
    ON public.user_devices FOR DELETE
    USING (auth.uid() = user_id);

-- Notifications RLS
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Service Role full access
DROP POLICY IF EXISTS "Service role has full access to user_devices" ON public.user_devices;
CREATE POLICY "Service role has full access to user_devices"
    ON public.user_devices FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to notifications" ON public.notifications;
CREATE POLICY "Service role has full access to notifications"
    ON public.notifications FOR ALL
    USING (true)
    WITH CHECK (true);
