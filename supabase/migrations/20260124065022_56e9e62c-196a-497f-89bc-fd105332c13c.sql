-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (is_admin());

-- Allow admins to insert time-off requests on behalf of employees
CREATE POLICY "Admins can insert requests"
ON public.time_off_requests
FOR INSERT
WITH CHECK (is_admin());

-- Allow admins to delete any request
CREATE POLICY "Admins can delete any request"
ON public.time_off_requests
FOR DELETE
USING (is_admin());