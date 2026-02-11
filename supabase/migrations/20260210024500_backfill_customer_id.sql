UPDATE public.gas_cylinder_orders
SET customer_id = customers.id
FROM public.customers
WHERE gas_cylinder_orders.customer_name = customers.name
  AND gas_cylinder_orders.customer_id IS NULL;
