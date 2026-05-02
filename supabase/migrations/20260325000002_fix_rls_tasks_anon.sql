-- Add full CRUD policies for anonymous and authenticated users on the tasks table.
-- The app does not enforce login for all users, so anon must also be able to read/write tasks.

-- SELECT: anon can read all tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks' AND policyname = 'Anonymous users can read tasks'
  ) THEN
    CREATE POLICY "Anonymous users can read tasks"
      ON public.tasks
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- INSERT: anon can create tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks' AND policyname = 'Anonymous users can insert tasks'
  ) THEN
    CREATE POLICY "Anonymous users can insert tasks"
      ON public.tasks
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

-- UPDATE: anon can update tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks' AND policyname = 'Anonymous users can update tasks'
  ) THEN
    CREATE POLICY "Anonymous users can update tasks"
      ON public.tasks
      FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- DELETE: anon can delete tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks' AND policyname = 'Anonymous users can delete tasks'
  ) THEN
    CREATE POLICY "Anonymous users can delete tasks"
      ON public.tasks
      FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

-- INSERT: authenticated users can create tasks (missing policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks' AND policyname = 'Authenticated users can insert tasks'
  ) THEN
    CREATE POLICY "Authenticated users can insert tasks"
      ON public.tasks
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- UPDATE: authenticated users can update tasks (missing policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks' AND policyname = 'Authenticated users can update tasks'
  ) THEN
    CREATE POLICY "Authenticated users can update tasks"
      ON public.tasks
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- DELETE: authenticated users can delete tasks (missing policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks' AND policyname = 'Authenticated users can delete tasks'
  ) THEN
    CREATE POLICY "Authenticated users can delete tasks"
      ON public.tasks
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
