
-- Add 'customer' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';

-- Create customer_users table
CREATE TABLE public.customer_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.customer_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_users
CREATE POLICY "Admins can manage customer_users"
  ON public.customer_users FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can view own customer_user link"
  ON public.customer_users FOR SELECT
  USING (auth.uid() = user_id);

-- Helper function: get customer_id for current user
CREATE OR REPLACE FUNCTION public.get_customer_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id FROM public.customer_users WHERE user_id = _user_id LIMIT 1
$$;

-- Update customer_products RLS: customers can view their own assortment
CREATE POLICY "Customers can view own assortment"
  ON public.customer_products FOR SELECT
  USING (
    customer_id = get_customer_id_for_user(auth.uid())
  );
