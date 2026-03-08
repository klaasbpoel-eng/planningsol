-- =============================================
-- 1. Fix profile privilege escalation
-- =============================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile safe fields" ON public.profiles;

CREATE POLICY "Users can update own profile safe fields"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND production_location IS NOT DISTINCT FROM (SELECT p.production_location FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_approved IS NOT DISTINCT FROM (SELECT p.is_approved FROM public.profiles p WHERE p.user_id = auth.uid())
  AND approved_by IS NOT DISTINCT FROM (SELECT p.approved_by FROM public.profiles p WHERE p.user_id = auth.uid())
  AND approved_at IS NOT DISTINCT FROM (SELECT p.approved_at FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- =============================================
-- 2. Harden customer_products read policy
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view customer products" ON public.customer_products;

CREATE POLICY "Operators and supervisors can view customer products"
ON public.customer_products FOR SELECT
TO authenticated
USING (
  is_admin()
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'operator'::app_role)
  OR customer_id = get_customer_id_for_user(auth.uid())
);

-- =============================================
-- 3. Clean up duplicate RPC functions (keep newest)
-- =============================================
DROP FUNCTION IF EXISTS public.get_customer_segments(integer, text);
DROP FUNCTION IF EXISTS public.get_customer_segments(integer, text, date, date);
DROP FUNCTION IF EXISTS public.get_daily_production_by_period(date, date, text);
DROP FUNCTION IF EXISTS public.get_daily_production_totals(integer, integer, text);
DROP FUNCTION IF EXISTS public.get_monthly_order_totals(integer, text, text);
DROP FUNCTION IF EXISTS public.get_production_efficiency(integer, text);
DROP FUNCTION IF EXISTS public.get_production_efficiency_by_period(date, date, text);