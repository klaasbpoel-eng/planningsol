-- Add pressure column to gas_cylinder_orders table
ALTER TABLE public.gas_cylinder_orders 
ADD COLUMN pressure integer NOT NULL DEFAULT 200;