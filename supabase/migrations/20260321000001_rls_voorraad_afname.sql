-- Enable RLS on ERP tables Voorraad and Afname (capital letters)
-- and add read policies for authenticated users.
-- These tables contain live stock/consumption data synced from the ERP system.

ALTER TABLE "Voorraad" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'Voorraad' AND policyname = 'Authenticated users can read Voorraad'
  ) THEN
    CREATE POLICY "Authenticated users can read Voorraad"
      ON "Voorraad"
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

ALTER TABLE "Afname" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'Afname' AND policyname = 'Authenticated users can read Afname'
  ) THEN
    CREATE POLICY "Authenticated users can read Afname"
      ON "Afname"
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
