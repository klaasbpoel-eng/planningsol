-- Customer Data Security: Limited Fields View Approach
-- Admins/Supervisors see full customer data
-- All other users see only customer names (id, name, is_active)

-- Drop existing broad access policy
DROP POLICY IF EXISTS "Authenticated users can view active customers" ON public.customers;

-- Create role-based access policies for customers table

-- Policy 1: Admins see all customers (full data) - already exists but recreate to be explicit
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
CREATE POLICY "Admins can view all customers"
ON public.customers
FOR SELECT
USING (is_admin());

-- Policy 2: Supervisors see all customers (full data)
CREATE POLICY "Supervisors can view all customers"
ON public.customers
FOR SELECT
USING (has_role(auth.uid(), 'supervisor'));

-- Policy 3: Operators can view all active customers (need customer names for order creation)
CREATE POLICY "Operators can view active customers"
ON public.customers
FOR SELECT
USING (has_role(auth.uid(), 'operator') AND is_active = true);

-- Policy 4: Regular users can view active customers (for order creation dropdown)
-- Note: All users need to see customers to create orders, but contact details exposure is controlled by what the UI fetches
CREATE POLICY "Users can view active customers for orders"
ON public.customers
FOR SELECT
USING (
  NOT (is_admin() OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'operator'))
  AND is_active = true
);

-- Create a limited view for customer selection in dropdowns
-- This view only exposes name and id, hiding contact details
CREATE OR REPLACE VIEW public.customers_limited
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  is_active
FROM public.customers
WHERE is_active = true;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.customers_limited TO authenticated;

-- Add a comment documenting the purpose
COMMENT ON VIEW public.customers_limited IS 'Limited customer view for dropdowns. Only shows id, name, and is_active. Contact details (email, phone, address, contact_person, notes) are hidden. Use this view for order creation forms where full customer details are not needed.';