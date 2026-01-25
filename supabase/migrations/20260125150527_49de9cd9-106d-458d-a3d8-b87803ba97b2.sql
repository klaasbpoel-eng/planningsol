-- Add container_has_wheels column to dry_ice_orders for kunststof containers
ALTER TABLE public.dry_ice_orders 
ADD COLUMN container_has_wheels boolean DEFAULT NULL;