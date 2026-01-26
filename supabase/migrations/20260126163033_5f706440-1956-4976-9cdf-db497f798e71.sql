-- Create app_settings table for configurable application settings
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policies: All authenticated users can view settings
CREATE POLICY "Authenticated users can view settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can insert settings"
ON public.app_settings
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update settings"
ON public.app_settings
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete settings"
ON public.app_settings
FOR DELETE
USING (is_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default setting for default customer
INSERT INTO public.app_settings (key, value, description)
VALUES ('default_customer_name', 'SOL Nederland', 'Standaardklant voor nieuwe orders');