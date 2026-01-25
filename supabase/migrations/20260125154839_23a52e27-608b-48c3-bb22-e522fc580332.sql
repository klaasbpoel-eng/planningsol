-- Create enum for gas grade (medical vs technical)
CREATE TYPE public.gas_grade AS ENUM ('medical', 'technical');

-- Add gas_grade column to gas_cylinder_orders
ALTER TABLE public.gas_cylinder_orders 
ADD COLUMN gas_grade public.gas_grade NOT NULL DEFAULT 'technical';