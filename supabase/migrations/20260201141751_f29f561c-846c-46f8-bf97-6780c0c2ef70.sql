-- Add production_location column to dry_ice_orders table
ALTER TABLE public.dry_ice_orders 
ADD COLUMN location public.production_location NOT NULL DEFAULT 'sol_emmen'::production_location;