-- Force drop any CHECK constraint on the day_part column
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'time_off_requests'
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name = 'day_part'
  LOOP
    EXECUTE format('ALTER TABLE public.time_off_requests DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
  END LOOP;
END $$;
