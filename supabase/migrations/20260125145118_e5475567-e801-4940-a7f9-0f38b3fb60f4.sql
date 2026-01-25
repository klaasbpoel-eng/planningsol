-- Create dry ice product types table (replaces enum for flexibility)
CREATE TABLE public.dry_ice_product_types (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create packaging options table
CREATE TABLE public.dry_ice_packaging (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dry_ice_product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dry_ice_packaging ENABLE ROW LEVEL SECURITY;

-- RLS policies for product types - anyone authenticated can view active
CREATE POLICY "Authenticated users can view active product types"
ON public.dry_ice_product_types FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can view all product types"
ON public.dry_ice_product_types FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can create product types"
ON public.dry_ice_product_types FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update product types"
ON public.dry_ice_product_types FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete product types"
ON public.dry_ice_product_types FOR DELETE
USING (is_admin());

-- RLS policies for packaging - anyone authenticated can view active
CREATE POLICY "Authenticated users can view active packaging"
ON public.dry_ice_packaging FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can view all packaging"
ON public.dry_ice_packaging FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can create packaging"
ON public.dry_ice_packaging FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update packaging"
ON public.dry_ice_packaging FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete packaging"
ON public.dry_ice_packaging FOR DELETE
USING (is_admin());

-- Add triggers for updated_at
CREATE TRIGGER update_dry_ice_product_types_updated_at
BEFORE UPDATE ON public.dry_ice_product_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dry_ice_packaging_updated_at
BEFORE UPDATE ON public.dry_ice_packaging
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add packaging_id to dry_ice_orders
ALTER TABLE public.dry_ice_orders 
ADD COLUMN packaging_id UUID REFERENCES public.dry_ice_packaging(id) ON DELETE SET NULL;

-- Add product_type_id to link to the new table (keeping product_type enum for backwards compatibility)
ALTER TABLE public.dry_ice_orders 
ADD COLUMN product_type_id UUID REFERENCES public.dry_ice_product_types(id) ON DELETE SET NULL;

-- Insert default product types based on existing enum
INSERT INTO public.dry_ice_product_types (name, description, sort_order) VALUES
('Blokken', '10kg blokken droogijs', 1),
('Pellets', '3mm pellets droogijs', 2),
('Sticks', '16mm sticks droogijs', 3);

-- Insert default packaging options
INSERT INTO public.dry_ice_packaging (name, description, sort_order) VALUES
('Piepschuim box', 'Standaard isolerende piepschuim verpakking', 1),
('Kartonnen doos', 'Kartonnen doos met isolatie', 2),
('Kunststof container', 'Herbruikbare kunststof container', 3),
('Bulk (onverpakt)', 'Geen verpakking, bulk levering', 4);

-- Create indexes
CREATE INDEX idx_dry_ice_orders_packaging_id ON public.dry_ice_orders(packaging_id);
CREATE INDEX idx_dry_ice_orders_product_type_id ON public.dry_ice_orders(product_type_id);