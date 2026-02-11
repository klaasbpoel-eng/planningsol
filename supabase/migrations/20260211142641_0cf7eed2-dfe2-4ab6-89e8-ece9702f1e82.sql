
-- Orders: customers can insert orders for their own customer account
CREATE POLICY "Customers can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'customer') AND
    customer_id = get_customer_id_for_user(auth.uid())
  );

-- Orders: customers can view own orders
CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  USING (
    has_role(auth.uid(), 'customer') AND
    customer_id = get_customer_id_for_user(auth.uid())
  );

-- Order items: customers can insert items for their own orders
CREATE POLICY "Customers can create own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'customer') AND
    order_id IN (
      SELECT id FROM public.orders
      WHERE customer_id = get_customer_id_for_user(auth.uid())
    )
  );

-- Order items: customers can view items of their own orders
CREATE POLICY "Customers can view own order items"
  ON public.order_items FOR SELECT
  USING (
    has_role(auth.uid(), 'customer') AND
    order_id IN (
      SELECT id FROM public.orders
      WHERE customer_id = get_customer_id_for_user(auth.uid())
    )
  );
