-- Add employee details columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS hire_date date,
ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'full-time',
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS emergency_contact_name text,
ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- Create employee leave balances table
CREATE TABLE public.employee_leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES public.time_off_types(id) ON DELETE CASCADE,
  annual_allowance numeric(5,2) NOT NULL DEFAULT 0,
  used_days numeric(5,2) NOT NULL DEFAULT 0,
  carried_over numeric(5,2) NOT NULL DEFAULT 0,
  accrual_rate numeric(5,2) DEFAULT 0,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, type_id, year)
);

-- Enable RLS on leave balances
ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;

-- Users can view their own balances
CREATE POLICY "Users can view own leave balances"
ON public.employee_leave_balances
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all balances
CREATE POLICY "Admins can view all leave balances"
ON public.employee_leave_balances
FOR SELECT
USING (is_admin());

-- Admins can insert balances
CREATE POLICY "Admins can insert leave balances"
ON public.employee_leave_balances
FOR INSERT
WITH CHECK (is_admin());

-- Admins can update balances
CREATE POLICY "Admins can update leave balances"
ON public.employee_leave_balances
FOR UPDATE
USING (is_admin());

-- Admins can delete balances
CREATE POLICY "Admins can delete leave balances"
ON public.employee_leave_balances
FOR DELETE
USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_employee_leave_balances_updated_at
BEFORE UPDATE ON public.employee_leave_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();