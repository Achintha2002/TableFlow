-- ENUMS
CREATE TYPE user_role AS ENUM ('customer', 'admin', 'staff');
CREATE TYPE table_status AS ENUM ('available', 'occupied', 'cleaning');
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE queue_status AS ENUM ('waiting', 'notified', 'seated', 'no_show', 'cancelled');
CREATE TYPE order_status AS ENUM ('pending', 'preparing', 'ready', 'served', 'cancelled');

-- 1. Users
CREATE TABLE users (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone_number TEXT,
    role user_role DEFAULT 'customer'::user_role,
    loyalty_tier TEXT DEFAULT 'Bronze',
    loyalty_points INT DEFAULT 0,
    fcm_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Accessibility Settings
CREATE TABLE accessibility_settings (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    font_size TEXT DEFAULT 'medium',
    high_contrast BOOLEAN DEFAULT false
);

-- 3. Table Categories / Zones
CREATE TABLE table_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, -- e.g., 'Window Seating', 'VIP Area'
    description TEXT,
    extra_charge DECIMAL(10, 2) DEFAULT 0.00
);

-- 4. Restaurant Tables
CREATE TABLE restaurant_tables (
    id SERIAL PRIMARY KEY,
    table_number INT UNIQUE NOT NULL,
    category_id INT REFERENCES table_categories(id) ON DELETE SET NULL,
    capacity INT NOT NULL,
    status table_status DEFAULT 'available'::table_status,
    x_coordinate FLOAT, -- For interactive floor plan
    y_coordinate FLOAT  -- For interactive floor plan
);

-- 5. Reservations
CREATE TABLE reservations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    table_id INT REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    pax INT NOT NULL,
    status reservation_status DEFAULT 'pending'::reservation_status,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prevent double-booking: no two active reservations for the same table
-- at the same date/time (DB-level safety net on top of app logic checks)
CREATE UNIQUE INDEX unique_active_table_slot
ON reservations (table_id, reservation_date, reservation_time)
WHERE status IN ('pending', 'confirmed');

-- 6. Queue Entries (Live Waitlist)
CREATE TABLE queue_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    pax INT NOT NULL,
    estimated_wait_time_mins INT,
    status queue_status DEFAULT 'waiting'::queue_status,
    qr_code_token TEXT UNIQUE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notified_at TIMESTAMP WITH TIME ZONE,
    seated_at TIMESTAMP WITH TIME ZONE
);

-- 7. Menu Items
CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true
);

-- 8. Orders (Dine-in Pre-Ordering)
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    queue_entry_id UUID REFERENCES queue_entries(id) ON DELETE CASCADE,
    total_amount DECIMAL(10, 2) NOT NULL,
    status order_status DEFAULT 'pending'::order_status,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (reservation_id IS NOT NULL OR queue_entry_id IS NOT NULL) -- Order must link to booking or queue
);

-- 9. Order Items
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INT REFERENCES menu_items(id) ON DELETE SET NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    special_instructions TEXT
);

-- 10. Notifications
CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS) — ALL TABLES
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- USERS: users can read/update their own profile; admins can read all
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all users" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ACCESSIBILITY SETTINGS: owner only
CREATE POLICY "Users manage own accessibility settings" ON accessibility_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TABLE CATEGORIES: public read, admin write
CREATE POLICY "Anyone can view table categories" ON table_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage table categories" ON table_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- RESTAURANT TABLES: public read (needed for floor plan), admin write
CREATE POLICY "Anyone can view tables" ON restaurant_tables FOR SELECT USING (true);
CREATE POLICY "Admins can manage tables" ON restaurant_tables FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- RESERVATIONS: admins full access; users can view/create/cancel their own
CREATE POLICY "Admins full access to reservations" ON reservations FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);
CREATE POLICY "Users can view own reservations" ON reservations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reservations" ON reservations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can cancel own reservations" ON reservations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- QUEUE ENTRIES: admins full access; users can view/create/cancel their own
CREATE POLICY "Admins full access to queue" ON queue_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);
CREATE POLICY "Users can view own queue entries" ON queue_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can join queue" ON queue_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave queue" ON queue_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- MENU ITEMS: public read, admin write
CREATE POLICY "Anyone can view available menu items" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage menu items" ON menu_items FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- ORDERS: admins full access; users can view/create their own
CREATE POLICY "Admins full access to orders" ON orders FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ORDER ITEMS: follow parent order's ownership
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Admins full access to order items" ON order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- NOTIFICATIONS: owner only
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can mark own notifications read" ON notifications FOR UPDATE USING (auth.uid() = user_id);
