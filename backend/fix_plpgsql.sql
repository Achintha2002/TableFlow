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
