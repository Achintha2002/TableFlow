-- Fix the infinite recursion by completely removing the Admin/Manager policy on users.
-- The Admin Dashboard now fetches users via the backend API using the Service Role Key, 
-- so it does not need RLS access to the users table anymore.
-- By removing this, we break the cyclic dependency where get_my_role() queries users 
-- and triggers a policy that calls get_my_role() again.

DROP POLICY IF EXISTS "Admins and Managers can view all users" ON users;
