-- Allow all authenticated users to view ALL profiles.
-- Required so the shared calendar can resolve employee names.
-- The previous security migration (20260125072729) restricted profiles to
-- "own profile only" for regular users. That breaks the calendar which needs
-- to display names for ALL colleagues' leave/task entries.
-- Note: this is an internal company tool; employees seeing colleagues'
-- names (not passwords/sensitive data) is intentional and required.

-- Also ensure all authenticated users can view ALL time_off_requests
-- (the calendar is a shared team overview, not a personal view).

-- 1. Profiles: all authenticated users can see all profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'Authenticated users can view all profiles'
  ) THEN
    CREATE POLICY "Authenticated users can view all profiles"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 2. Time-off requests: all authenticated users can view all requests
--    (so the calendar shows the full team's schedule)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'time_off_requests'
      AND policyname = 'Authenticated users can view all time off requests'
  ) THEN
    CREATE POLICY "Authenticated users can view all time off requests"
      ON public.time_off_requests
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
