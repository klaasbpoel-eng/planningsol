-- Add is_digital flag to gas_types table
ALTER TABLE public.gas_types ADD COLUMN is_digital boolean NOT NULL DEFAULT false;