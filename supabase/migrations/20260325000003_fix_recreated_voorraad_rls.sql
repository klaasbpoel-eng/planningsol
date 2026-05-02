-- Re-apply policies to Voorraad (if recreated) and Afname
DO $$
BEGIN
  -- Enable RLS just in case it isn't
  ALTER TABLE IF EXISTS "Voorraad" ENABLE ROW LEVEL SECURITY;
  
  -- Re-add public read policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'Voorraad' AND policyname = 'Public users can read Voorraad'
  ) THEN
    CREATE POLICY "Public users can read Voorraad"
      ON "Voorraad"
      FOR SELECT
      TO public
      USING (true);
  END IF;
  
  -- Same for Afname just in case
  ALTER TABLE IF EXISTS "Afname" ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'Afname' AND policyname = 'Public users can read Afname'
  ) THEN
    CREATE POLICY "Public users can read Afname"
      ON "Afname"
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;
