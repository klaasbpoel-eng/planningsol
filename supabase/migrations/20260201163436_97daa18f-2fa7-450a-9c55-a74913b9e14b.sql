-- Create gas type categories table
CREATE TABLE public.gas_type_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add category_id to gas_types table
ALTER TABLE public.gas_types 
ADD COLUMN category_id UUID REFERENCES public.gas_type_categories(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_gas_types_category_id ON public.gas_types(category_id);

-- Enable Row Level Security
ALTER TABLE public.gas_type_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gas_type_categories
CREATE POLICY "Admins can create gas type categories" 
ON public.gas_type_categories 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update gas type categories" 
ON public.gas_type_categories 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins can delete gas type categories" 
ON public.gas_type_categories 
FOR DELETE 
USING (is_admin());

CREATE POLICY "Admins can view all gas type categories" 
ON public.gas_type_categories 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Authenticated users can view active gas type categories" 
ON public.gas_type_categories 
FOR SELECT 
USING (is_active = true);

-- Create updated_at trigger
CREATE TRIGGER update_gas_type_categories_updated_at
BEFORE UPDATE ON public.gas_type_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.gas_type_categories (name, sort_order) VALUES
('Industriële gassen', 1),
('Lasgassen (Weldmix)', 2),
('Medische gassen', 3),
('Speciale mengsels', 4);