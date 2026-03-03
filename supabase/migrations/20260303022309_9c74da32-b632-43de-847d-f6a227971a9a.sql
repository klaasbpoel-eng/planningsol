
CREATE TABLE public.stock_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  filled_in_emmen boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;

-- Admins: volledige CRUD
CREATE POLICY "Admins can manage stock products" ON public.stock_products
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Authenticated: lezen
CREATE POLICY "Authenticated can view stock products" ON public.stock_products
  FOR SELECT TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_stock_products_updated_at
  BEFORE UPDATE ON public.stock_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
