-- Add read policies for anonymous users since the web app does not use authentication yet.
-- This fixes the issue where the frontend gets an empty array "[]" for Voorraad and Afname.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'Voorraad' AND policyname = 'Anonymous users can read Voorraad'
  ) THEN
    CREATE POLICY "Anonymous users can read Voorraad"
      ON "Voorraad"
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'Afname' AND policyname = 'Anonymous users can read Afname'
  ) THEN
    CREATE POLICY "Anonymous users can read Afname"
      ON "Afname"
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
