
-- Add capacity_kg column to dry_ice_packaging table
ALTER TABLE public.dry_ice_packaging 
ADD COLUMN capacity_kg numeric DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.dry_ice_packaging.capacity_kg IS 'Default capacity/weight in kilograms for this packaging type';
