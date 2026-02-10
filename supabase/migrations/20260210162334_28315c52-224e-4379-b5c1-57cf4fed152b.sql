
-- Fix 1: customers_limited view - add security_invoker to respect RLS
CREATE OR REPLACE VIEW public.customers_limited
WITH (security_invoker = on) AS
SELECT id, name, is_active
FROM public.customers;

-- Fix 2: toolboxes - replace overly permissive ALL policy with proper role-based policies
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.toolboxes;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.toolboxes;

-- Read access for all authenticated users (SELECT with true is fine per linter)
CREATE POLICY "Authenticated users can view toolboxes"
ON public.toolboxes
FOR SELECT
TO authenticated
USING (true);

-- Write access restricted to admins only
CREATE POLICY "Admins can insert toolboxes"
ON public.toolboxes
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update toolboxes"
ON public.toolboxes
FOR UPDATE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can delete toolboxes"
ON public.toolboxes
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Fix 3: notifications INSERT - replace WITH CHECK (true) with proper check
-- The "Only service role can insert notifications" policy uses WITH CHECK (true)
-- This is used by database triggers (SECURITY DEFINER functions) which run as postgres role
-- Replace with a policy that allows the trigger function to insert
DROP POLICY IF EXISTS "Only service role can insert notifications" ON public.notifications;

-- Keep the user-level insert policy (already exists: "Users can only insert own notifications")
-- For trigger-based inserts, SECURITY DEFINER functions bypass RLS, so no additional policy needed
