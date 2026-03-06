-- Drop all FK constraints referencing profiles so historical data can be imported
-- without requiring auth users / profiles to exist first.

-- internal_orders
ALTER TABLE public.internal_orders
  DROP CONSTRAINT IF EXISTS internal_orders_created_by_fkey,
  ALTER COLUMN created_by DROP NOT NULL;

-- time_off_requests
ALTER TABLE public.time_off_requests
  DROP CONSTRAINT IF EXISTS time_off_requests_profile_id_fkey,
  DROP CONSTRAINT IF EXISTS time_off_requests_approved_by_fkey,
  ALTER COLUMN profile_id DROP NOT NULL;

-- toolbox_sessions
ALTER TABLE public.toolbox_sessions
  DROP CONSTRAINT IF EXISTS toolbox_sessions_instructor_id_fkey;

-- toolbox_session_participants
ALTER TABLE public.toolbox_session_participants
  DROP CONSTRAINT IF EXISTS toolbox_session_participants_profile_id_fkey,
  ALTER COLUMN profile_id DROP NOT NULL;
