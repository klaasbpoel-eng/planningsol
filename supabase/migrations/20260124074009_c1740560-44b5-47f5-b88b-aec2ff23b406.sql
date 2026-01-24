-- Drop the existing restrictive SELECT policies
DROP POLICY IF EXISTS "Users can view own requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.time_off_requests;

-- Create a new policy that allows all authenticated users to view all requests
CREATE POLICY "Authenticated users can view all requests"
ON public.time_off_requests
FOR SELECT
TO authenticated
USING (true);