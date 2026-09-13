-- 1. Enable Realtime for the orders table so the app can listen for status updates
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- 2. Fix the RLS policy for order_items that is blocking the insert
DROP POLICY IF EXISTS "Users can create own order items" ON order_items;
CREATE POLICY "Users can create own order items" ON order_items FOR INSERT WITH CHECK (
  (SELECT user_id FROM orders WHERE id = order_id) = auth.uid()
);
