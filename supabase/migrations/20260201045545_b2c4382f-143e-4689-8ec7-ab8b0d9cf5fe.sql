-- Recreate the gas_cylinder_orders table
CREATE TABLE public.gas_cylinder_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  gas_type public.gas_type NOT NULL DEFAULT 'co2'::gas_type,
  gas_type_id uuid REFERENCES public.gas_types(id) ON DELETE SET NULL,
  gas_grade public.gas_grade NOT NULL DEFAULT 'technical'::gas_grade,
  cylinder_count integer NOT NULL,
  cylinder_size text NOT NULL DEFAULT 'medium'::text,
  pressure integer NOT NULL DEFAULT 200,
  scheduled_date date NOT NULL,
  status public.production_order_status NOT NULL DEFAULT 'pending'::production_order_status,
  location public.production_location NOT NULL DEFAULT 'sol_emmen'::production_location,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
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
CREATE INDEX idx_gas_cylinder_orders_scheduled_date ON public.gas_cylinder_orders(scheduled_date);
CREATE INDEX idx_gas_cylinder_orders_customer_id ON public.gas_cylinder_orders(customer_id);
CREATE INDEX idx_gas_cylinder_orders_gas_type_id ON public.gas_cylinder_orders(gas_type_id);
CREATE INDEX idx_gas_cylinder_orders_status ON public.gas_cylinder_orders(status);
CREATE INDEX idx_gas_cylinder_orders_location ON public.gas_cylinder_orders(location);

-- Create trigger for updated_at
CREATE TRIGGER update_gas_cylinder_orders_updated_at
  BEFORE UPDATE ON public.gas_cylinder_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();