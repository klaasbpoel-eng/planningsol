-- Drop existing SELECT policies on profiles that allow broad access
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create helper function to check if user has elevated role (admin, supervisor, or operator)
CREATE OR REPLACE FUNCTION public.has_elevated_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'supervisor', 'operator')
  )
$$;

-- Policy: Admins can view all profiles (full access)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin());

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (user_id IS NOT NULL AND auth.uid() = user_id);

-- Policy: Supervisors and operators can view limited profile info for work assignments
-- This allows them to see other employees for task assignments, but RLS limits what they can access
CREATE POLICY "Elevated roles can view profiles for assignments"
ON public.profiles
FOR SELECT
USING (
  public.has_elevated_role(auth.uid()) 
  AND is_approved = true
);

-- Drop and recreate the profiles_limited view with tighter security
-- This view is used for dropdowns and assignments, accessible only to elevated roles
DROP VIEW IF EXISTS public.profiles_limited;

CREATE VIEW public.profiles_limited
WITH (security_invoker = on) AS
SELECT 
  id, 
  user_id, 
  full_name, 
  department, 
  job_title
FROM public.profiles
WHERE is_approved = true;

-- Note: We removed 'email' from profiles_limited to reduce exposure
-- Email is only needed for admin functions, not for assignment dropdowns

-- Grant access to the view
GRANT SELECT ON public.profiles_limited TO authenticated;

COMMENT ON VIEW public.profiles_limited IS 'Limited view of profiles for employee assignments. Only shows approved employees. Access controlled by underlying profiles table RLS policies.';