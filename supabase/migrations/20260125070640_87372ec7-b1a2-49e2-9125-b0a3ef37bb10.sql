-- Drop the overly permissive INSERT policy on notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create a more restrictive policy that only allows service role (triggers use SECURITY DEFINER)
-- Regular users should not be able to insert notifications directly
CREATE POLICY "Only service role can insert notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- Add policy so authenticated users can only insert notifications for themselves (fallback)
CREATE POLICY "Users can only insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);