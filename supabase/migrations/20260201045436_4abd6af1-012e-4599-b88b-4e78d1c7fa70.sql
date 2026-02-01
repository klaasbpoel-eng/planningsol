-- Drop the gas_cylinder_orders table and all its dependencies
-- WARNING: This will permanently delete 127,538 orders!

-- First drop the RLS policies
DROP POLICY IF EXISTS "Admins can create gas cylinder orders" ON gas_cylinder_orders;
DROP POLICY IF EXISTS "Admins can delete gas cylinder orders" ON gas_cylinder_orders;
DROP POLICY IF EXISTS "Admins can update gas cylinder orders" ON gas_cylinder_orders;
DROP POLICY IF EXISTS "Admins can view all gas cylinder orders" ON gas_cylinder_orders;
DROP POLICY IF EXISTS "Users can view assigned or created gas cylinder orders" ON gas_cylinder_orders;

-- Drop the table (this will also drop any indexes and constraints)
DROP TABLE IF EXISTS public.gas_cylinder_orders CASCADE;