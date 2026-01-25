-- =============================================
-- SECURITY FIX: Restrict Data Access Policies
-- =============================================

-- 1. PROFILES TABLE: Restrict access to own profile + admins
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;

-- Users can view their own full profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all profiles (for employee management)
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

-- Create a public view with limited profile data for dropdowns/assignments
CREATE VIEW public.profiles_limited
WITH (security_invoker = on) AS
  SELECT id, user_id, full_name, email, department, job_title
  FROM profiles;

-- 2. TIME_OFF_REQUESTS TABLE: Restrict to own requests + admins
DROP POLICY IF EXISTS "Authenticated users can view all requests" ON time_off_requests;

-- Users can only view their own requests
CREATE POLICY "Users can view own requests"
  ON time_off_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON time_off_requests FOR SELECT
  USING (is_admin());

-- 3. TASKS TABLE: Restrict to assigned/created tasks + admins
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON tasks;

-- Users can view tasks assigned to them or created by them
CREATE POLICY "Users can view assigned or created tasks"
  ON tasks FOR SELECT
  USING (
    auth.uid() = assigned_to 
    OR auth.uid() = created_by
    OR is_admin()
  );

-- 4. ADD MISSING NOTIFICATION TRIGGER
CREATE TRIGGER on_task_changes
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();