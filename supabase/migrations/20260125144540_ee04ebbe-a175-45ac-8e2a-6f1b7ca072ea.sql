-- Create customers table
CREATE TABLE public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS policies - all authenticated users can view active customers
CREATE POLICY "Authenticated users can view active customers"
ON public.customers FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins can manage all customers
CREATE POLICY "Admins can view all customers"
ON public.customers FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can create customers"
ON public.customers FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update customers"
ON public.customers FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete customers"
ON public.customers FOR DELETE
USING (is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_customers_is_active ON public.customers(is_active);

-- Add customer_id column to existing orders tables
ALTER TABLE public.dry_ice_orders 
ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.gas_cylinder_orders 
ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create indexes for the new foreign keys
CREATE INDEX idx_dry_ice_orders_customer_id ON public.dry_ice_orders(customer_id);
CREATE INDEX idx_gas_cylinder_orders_customer_id ON public.gas_cylinder_orders(customer_id);