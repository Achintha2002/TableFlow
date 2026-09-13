-- Create a security definer function to get the current user's role, bypassing RLS
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM users WHERE id = auth.uid();
$$;

-- Fix Users Policies
DROP POLICY IF EXISTS "Admins and Managers can view all users" ON users;
CREATE POLICY "Admins and Managers can view all users" ON users FOR SELECT USING (
  get_my_role() IN ('admin', 'manager')
);

-- Fix Orders Policies
DROP POLICY IF EXISTS "Admins, Managers, and Cashiers can view all orders" ON orders;
CREATE POLICY "Admins, Managers, and Cashiers can view all orders" ON orders FOR SELECT USING (
  get_my_role() IN ('admin', 'manager', 'cashier')
);

-- Fix Queue Entries Policies
DROP POLICY IF EXISTS "Admins and Managers can view queue" ON queue_entries;
CREATE POLICY "Admins and Managers can view queue" ON queue_entries FOR SELECT USING (
  get_my_role() IN ('admin', 'manager', 'cashier')
);

