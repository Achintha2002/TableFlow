-- 1. Create a security definer function to get the current user's role safely
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM users WHERE id = auth.uid();
$$;

-- 2. Drop problematic policies that query the users table directly causing infinite recursion
DROP POLICY IF EXISTS "Admins and Managers can manage table categories" ON table_categories;
DROP POLICY IF EXISTS "Admins and Managers can manage tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admins and Managers full access to reservations" ON reservations;
DROP POLICY IF EXISTS "Admins and Managers can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins and Managers full access to order items" ON order_items;
DROP POLICY IF EXISTS "Cashier can view orders" ON orders;
DROP POLICY IF EXISTS "Cashier can update orders" ON orders;
DROP POLICY IF EXISTS "Cashier can view queue" ON queue_entries;
DROP POLICY IF EXISTS "Cashier can update queue" ON queue_entries;

-- Note: We already updated these in fix_rls.sql, but let's make sure
DROP POLICY IF EXISTS "Admins and Managers full access to orders" ON orders;
DROP POLICY IF EXISTS "Admins and Managers full access to queue" ON queue_entries;


-- Recreate them using get_my_role() which bypasses RLS safely

CREATE POLICY "Admins and Managers can manage table categories" ON table_categories FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
);

CREATE POLICY "Admins and Managers can manage tables" ON restaurant_tables FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
);

CREATE POLICY "Admins and Managers full access to reservations" ON reservations FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
);

CREATE POLICY "Admins and Managers can manage menu items" ON menu_items FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
);

CREATE POLICY "Admins and Managers full access to order items" ON order_items FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
);

-- Orders
CREATE POLICY "Staff can view orders" ON orders FOR SELECT USING (
  get_my_role() IN ('admin', 'manager', 'cashier', 'kitchen')
);
CREATE POLICY "Staff can update orders" ON orders FOR UPDATE USING (
  get_my_role() IN ('admin', 'manager', 'cashier', 'kitchen')
);

-- Queue Entries
CREATE POLICY "Staff can view queue" ON queue_entries FOR SELECT USING (
  get_my_role() IN ('admin', 'manager', 'cashier')
);
CREATE POLICY "Staff can update queue" ON queue_entries FOR UPDATE USING (
  get_my_role() IN ('admin', 'manager', 'cashier')
);

