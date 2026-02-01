-- Add production_location column to profiles table for operators/supervisors
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS production_location public.production_location NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.production_location IS 'Assigned production location for operators and supervisors. NULL means all locations (for admins).';

-- Create a helper function to get user's assigned location
CREATE OR REPLACE FUNCTION public.get_user_production_location(_user_id uuid)
RETURNS public.production_location
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.production_location
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1
$$;