-- =============================================
-- Fix: Enable RLS on tables flagged by Security Advisor
-- =============================================

-- 1. Tables with policies but RLS not enabled
ALTER TABLE public.customer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 2. Lookup tables: time_off_types and task_types
--    These are reference/lookup tables - authenticated users can read, only admins can modify

ALTER TABLE public.time_off_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view time off types" ON public.time_off_types;
CREATE POLICY "Authenticated users can view time off types"
ON public.time_off_types FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage time off types" ON public.time_off_types;
CREATE POLICY "Admins can manage time off types"
ON public.time_off_types FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());


ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view task types" ON public.task_types;
CREATE POLICY "Authenticated users can view task types"
ON public.task_types FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage task types" ON public.task_types;
CREATE POLICY "Admins can manage task types"
ON public.task_types FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
