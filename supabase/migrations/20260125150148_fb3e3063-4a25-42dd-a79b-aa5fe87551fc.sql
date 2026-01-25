-- Add box_count column to dry_ice_orders for EPS packaging
ALTER TABLE public.dry_ice_orders 
ADD COLUMN box_count integer DEFAULT NULL;