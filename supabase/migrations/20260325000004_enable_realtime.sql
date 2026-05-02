-- Create publication if it doesn't exist (Supabase creates this by default, but just in case)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add Voorraad to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE "Voorraad";

-- Add Afname to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE "Afname";
