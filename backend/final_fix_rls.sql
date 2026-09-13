-- 1. Create a security definer function to get the current user's role safely (prevents inlining & recursion)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role::text INTO v_role FROM users WHERE id = auth.uid();
  RETURN v_role;
END;
$$;

-- 2. Drop EVERY recursive policy from Phase 4
DROP POLICY IF EXISTS "Admins and Managers can view all users" ON users;
DROP POLICY IF EXISTS "Admins and Managers can manage table categories" ON table_categories;
DROP POLICY IF EXISTS "Admins and Managers can manage tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admins and Managers full access to reservations" ON reservations;
DROP POLICY IF EXISTS "Admins and Managers full access to queue" ON queue_entries;
DROP POLICY IF EXISTS "Admins and Managers can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins and Managers full access to orders" ON orders;
DROP POLICY IF EXISTS "Admins and Managers full access to order items" ON order_items;
DROP POLICY IF EXISTS "Cashier can view orders" ON orders;
DROP POLICY IF EXISTS "Cashier can update orders" ON orders;
DROP POLICY IF EXISTS "Cashier can view queue" ON queue_entries;
DROP POLICY IF EXISTS "Cashier can update queue" ON queue_entries;
DROP POLICY IF EXISTS "Staff can view orders" ON orders;
DROP POLICY IF EXISTS "Staff can update orders" ON orders;
DROP POLICY IF EXISTS "Staff can view queue" ON queue_entries;
DROP POLICY IF EXISTS "Staff can update queue" ON queue_entries;

-- 3. Recreate them safely using get_my_role()
CREATE POLICY "Admins and Managers can view all users" ON users FOR SELECT USING (
  get_my_role() IN ('admin', 'manager')
);

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

CREATE POLICY "Staff can view orders" ON orders FOR SELECT USING (
  get_my_role() IN ('admin', 'manager', 'cashier', 'kitchen')
);

CREATE POLICY "Staff can update orders" ON orders FOR UPDATE USING (
  get_my_role() IN ('admin', 'manager', 'cashier', 'kitchen')
);

CREATE POLICY "Staff can view queue" ON queue_entries FOR SELECT USING (
  get_my_role() IN ('admin', 'manager', 'cashier')
);

CREATE POLICY "Staff can update queue" ON queue_entries FOR UPDATE USING (
  get_my_role() IN ('admin', 'manager', 'cashier')
);
