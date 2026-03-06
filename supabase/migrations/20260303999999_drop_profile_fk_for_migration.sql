-- Drop profile FK constraints from order tables so historical data can be
-- imported without requiring profiles/auth users to exist first.
-- The original creator UUIDs are preserved in the data; they just won't be
-- enforced as FKs (acceptable for migrated historical records).

ALTER TABLE public.gas_cylinder_orders
  DROP CONSTRAINT IF EXISTS gas_cylinder_orders_created_by_fkey,
  DROP CONSTRAINT IF EXISTS gas_cylinder_orders_assigned_to_fkey,
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.dry_ice_orders
  DROP CONSTRAINT IF EXISTS dry_ice_orders_created_by_fkey,
  DROP CONSTRAINT IF EXISTS dry_ice_orders_assigned_to_fkey,
  ALTER COLUMN created_by DROP NOT NULL;
