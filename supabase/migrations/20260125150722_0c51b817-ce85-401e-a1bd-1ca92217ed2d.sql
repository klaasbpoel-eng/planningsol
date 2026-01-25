-- Add recurrence columns to dry_ice_orders
ALTER TABLE public.dry_ice_orders 
ADD COLUMN is_recurring boolean DEFAULT false,
ADD COLUMN recurrence_end_date date DEFAULT NULL,
ADD COLUMN parent_order_id uuid REFERENCES public.dry_ice_orders(id) DEFAULT NULL;

-- Add same columns to gas_cylinder_orders for consistency
ALTER TABLE public.gas_cylinder_orders 
ADD COLUMN is_recurring boolean DEFAULT false,
ADD COLUMN recurrence_end_date date DEFAULT NULL,
ADD COLUMN parent_order_id uuid REFERENCES public.gas_cylinder_orders(id) DEFAULT NULL;