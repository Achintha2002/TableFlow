-- Phase 4.0: Staff RBAC Schema Updates
-- IMPORTANT: Postgres requires ENUM updates to be committed before they are used.
-- YOU MUST RUN THIS SCRIPT IN TWO SEPARATE STEPS.

-- ==========================================
-- STEP 1: RUN ONLY THIS BLOCK FIRST
-- Highlight lines 7-9 and click "Run"
-- ==========================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'kitchen';

-- ==========================================
-- STEP 2: AFTER STEP 1 SUCCEEDS, RUN THIS BLOCK
-- Highlight the rest of the file and click "Run"
-- ==========================================

-- 2. Update existing admin policies to also allow 'manager'
-- Note: We recreate these policies to include manager

-- USERS
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins and Managers can view all users" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager'))
);

-- TABLE CATEGORIES
DROP POLICY IF EXISTS "Admins can manage table categories" ON table_categories;
CREATE POLICY "Admins and Managers can manage table categories" ON table_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
);

-- RESTAURANT TABLES
DROP POLICY IF EXISTS "Admins can manage tables" ON restaurant_tables;
CREATE POLICY "Admins and Managers can manage tables" ON restaurant_tables FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
);

-- RESERVATIONS
DROP POLICY IF EXISTS "Admins full access to reservations" ON reservations;
CREATE POLICY "Admins and Managers full access to reservations" ON reservations FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
);

-- QUEUE ENTRIES
DROP POLICY IF EXISTS "Admins full access to queue" ON queue_entries;
CREATE POLICY "Admins and Managers full access to queue" ON queue_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
);

-- MENU ITEMS
DROP POLICY IF EXISTS "Admins can manage menu items" ON menu_items;
CREATE POLICY "Admins and Managers can manage menu items" ON menu_items FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
);

-- ORDERS
DROP POLICY IF EXISTS "Admins full access to orders" ON orders;
CREATE POLICY "Admins and Managers full access to orders" ON orders FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
);

-- ORDER ITEMS
DROP POLICY IF EXISTS "Admins full access to order items" ON order_items;
CREATE POLICY "Admins and Managers full access to order items" ON order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
);

-- 3. Add explicit Cashier policies for Orders and Queue Entries
-- Cashier: can view/update orders and queue entries only
CREATE POLICY "Cashier can view orders" ON orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'cashier')
);
CREATE POLICY "Cashier can update orders" ON orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'cashier')
);

CREATE POLICY "Cashier can view queue" ON queue_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'cashier')
);
CREATE POLICY "Cashier can update queue" ON queue_entries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'cashier')
);
