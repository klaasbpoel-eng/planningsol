-- Create gas_types table for manageable gas types
CREATE TABLE public.gas_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cylinder_sizes table for manageable cylinder sizes
CREATE TABLE public.cylinder_sizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  capacity_liters NUMERIC,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.gas_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cylinder_sizes ENABLE ROW LEVEL SECURITY;

-- RLS policies for gas_types
CREATE POLICY "Authenticated users can view active gas types" ON public.gas_types
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all gas types" ON public.gas_types
FOR SELECT USING (is_admin());

CREATE POLICY "Admins can create gas types" ON public.gas_types
FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update gas types" ON public.gas_types
FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete gas types" ON public.gas_types
FOR DELETE USING (is_admin());

-- RLS policies for cylinder_sizes
CREATE POLICY "Authenticated users can view active cylinder sizes" ON public.cylinder_sizes
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all cylinder sizes" ON public.cylinder_sizes
FOR SELECT USING (is_admin());

CREATE POLICY "Admins can create cylinder sizes" ON public.cylinder_sizes
FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update cylinder sizes" ON public.cylinder_sizes
FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete cylinder sizes" ON public.cylinder_sizes
FOR DELETE USING (is_admin());

-- Create triggers for updated_at
CREATE TRIGGER update_gas_types_updated_at
BEFORE UPDATE ON public.gas_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cylinder_sizes_updated_at
BEFORE UPDATE ON public.cylinder_sizes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default gas types based on existing enum values
INSERT INTO public.gas_types (name, description, color, sort_order) VALUES
('CO2', 'Koolstofdioxide', '#64748b', 1),
('Stikstof', 'Nitrogen', '#06b6d4', 2),
('Argon', 'Argon', '#8b5cf6', 3),
('Acetyleen', 'Acetyleen', '#f59e0b', 4),
('Zuurstof', 'Oxygen', '#ef4444', 5),
('Helium', 'Helium', '#ec4899', 6),
('Overig', 'Overige gassoorten', '#6b7280', 7);

-- Insert default cylinder sizes
INSERT INTO public.cylinder_sizes (name, capacity_liters, description, sort_order) VALUES
('Klein', 10, '10 liter cilinder', 1),
('Medium', 20, '20 liter cilinder', 2),
('Groot', 50, '50 liter cilinder', 3);