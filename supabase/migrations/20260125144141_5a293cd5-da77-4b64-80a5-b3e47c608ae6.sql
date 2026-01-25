-- Create enum for order status
CREATE TYPE public.production_order_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Create enum for dry ice product types
CREATE TYPE public.dry_ice_product_type AS ENUM ('blocks', 'pellets', 'sticks');

-- Create enum for gas types
CREATE TYPE public.gas_type AS ENUM ('co2', 'nitrogen', 'argon', 'acetylene', 'oxygen', 'helium', 'other');

-- Create dry ice orders table
CREATE TABLE public.dry_ice_orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    quantity_kg NUMERIC NOT NULL CHECK (quantity_kg > 0),
    product_type public.dry_ice_product_type NOT NULL DEFAULT 'blocks',
    scheduled_date DATE NOT NULL,
    status public.production_order_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gas cylinder orders table
CREATE TABLE public.gas_cylinder_orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    gas_type public.gas_type NOT NULL DEFAULT 'co2',
    cylinder_count INTEGER NOT NULL CHECK (cylinder_count > 0),
    cylinder_size TEXT NOT NULL DEFAULT 'medium',
    scheduled_date DATE NOT NULL,
    status public.production_order_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.dry_ice_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gas_cylinder_orders ENABLE ROW LEVEL SECURITY;

-- RLS policies for dry_ice_orders
CREATE POLICY "Admins can view all dry ice orders"
ON public.dry_ice_orders FOR SELECT
USING (is_admin());

CREATE POLICY "Users can view assigned or created dry ice orders"
ON public.dry_ice_orders FOR SELECT
USING (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can create dry ice orders"
ON public.dry_ice_orders FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update dry ice orders"
ON public.dry_ice_orders FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete dry ice orders"
ON public.dry_ice_orders FOR DELETE
USING (is_admin());

-- RLS policies for gas_cylinder_orders
CREATE POLICY "Admins can view all gas cylinder orders"
ON public.gas_cylinder_orders FOR SELECT
USING (is_admin());

CREATE POLICY "Users can view assigned or created gas cylinder orders"
ON public.gas_cylinder_orders FOR SELECT
USING (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can create gas cylinder orders"
ON public.gas_cylinder_orders FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update gas cylinder orders"
ON public.gas_cylinder_orders FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete gas cylinder orders"
ON public.gas_cylinder_orders FOR DELETE
USING (is_admin());

-- Add triggers for updated_at
CREATE TRIGGER update_dry_ice_orders_updated_at
BEFORE UPDATE ON public.dry_ice_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gas_cylinder_orders_updated_at
BEFORE UPDATE ON public.gas_cylinder_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_dry_ice_orders_scheduled_date ON public.dry_ice_orders(scheduled_date);
CREATE INDEX idx_dry_ice_orders_status ON public.dry_ice_orders(status);
CREATE INDEX idx_dry_ice_orders_created_by ON public.dry_ice_orders(created_by);
CREATE INDEX idx_dry_ice_orders_assigned_to ON public.dry_ice_orders(assigned_to);

CREATE INDEX idx_gas_cylinder_orders_scheduled_date ON public.gas_cylinder_orders(scheduled_date);
CREATE INDEX idx_gas_cylinder_orders_status ON public.gas_cylinder_orders(status);
CREATE INDEX idx_gas_cylinder_orders_created_by ON public.gas_cylinder_orders(created_by);
CREATE INDEX idx_gas_cylinder_orders_assigned_to ON public.gas_cylinder_orders(assigned_to);