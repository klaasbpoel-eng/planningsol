-- Create production_location enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.production_location AS ENUM ('sol_emmen', 'sol_tilburg');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create gas_cylinder_orders table
CREATE TABLE IF NOT EXISTS public.gas_cylinder_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  gas_type public.gas_type NOT NULL DEFAULT 'co2',
  gas_type_id UUID REFERENCES public.gas_types(id),
  gas_grade public.gas_grade NOT NULL DEFAULT 'technical',
  cylinder_count INTEGER NOT NULL,
  cylinder_size TEXT NOT NULL DEFAULT 'medium',
  pressure INTEGER NOT NULL DEFAULT 200,
  scheduled_date DATE NOT NULL,
  status public.production_order_status NOT NULL DEFAULT 'pending',
  location public.production_location NOT NULL DEFAULT 'sol_emmen',
  notes TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gas_cylinder_orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can view all gas cylinder orders"
ON public.gas_cylinder_orders FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can create gas cylinder orders"
ON public.gas_cylinder_orders FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update gas cylinder orders"
ON public.gas_cylinder_orders FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete gas cylinder orders"
ON public.gas_cylinder_orders FOR DELETE
USING (is_admin());

CREATE POLICY "Users can view assigned or created gas cylinder orders"
ON public.gas_cylinder_orders FOR SELECT
USING (
  (created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  OR (assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gas_cylinder_orders_scheduled_date ON public.gas_cylinder_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_gas_cylinder_orders_location ON public.gas_cylinder_orders(location);
CREATE INDEX IF NOT EXISTS idx_gas_cylinder_orders_status ON public.gas_cylinder_orders(status);

-- Create trigger for updated_at
CREATE TRIGGER update_gas_cylinder_orders_updated_at
BEFORE UPDATE ON public.gas_cylinder_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();