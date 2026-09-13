CREATE OR REPLACE FUNCTION get_pg_policies()
RETURNS TABLE(schemaname name, tablename name, policyname name, permissive text, roles name[], cmd text, qual text, with_check text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public';
$$;
