-- Add gas_type_id column to gas_cylinder_orders for direct link to gas_types table
ALTER TABLE public.gas_cylinder_orders 
ADD COLUMN gas_type_id uuid REFERENCES public.gas_types(id);

-- Create an index for better query performance
CREATE INDEX idx_gas_cylinder_orders_gas_type_id ON public.gas_cylinder_orders(gas_type_id);

-- Update existing records to link them to the corresponding gas_type based on the enum value
-- This maps the enum values to the gas_types table entries
UPDATE public.gas_cylinder_orders gco
SET gas_type_id = gt.id
FROM public.gas_types gt
WHERE 
  (gco.gas_type = 'co2' AND LOWER(gt.name) IN ('co2', 'koolzuurgas', 'kooldioxide')) OR
  (gco.gas_type = 'nitrogen' AND LOWER(gt.name) IN ('stikstof', 'nitrogen', 'n2')) OR
  (gco.gas_type = 'argon' AND LOWER(gt.name) IN ('argon', 'ar')) OR
  (gco.gas_type = 'acetylene' AND LOWER(gt.name) IN ('acetyleen', 'acetylene', 'c2h2')) OR
  (gco.gas_type = 'oxygen' AND LOWER(gt.name) IN ('zuurstof', 'oxygen', 'o2')) OR
  (gco.gas_type = 'helium' AND LOWER(gt.name) IN ('helium', 'he'));