CREATE OR REPLACE FUNCTION public.debug_productie_columns()
RETURNS TABLE (column_name text, data_type text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'Productie'
  ORDER BY ordinal_position;
$$;

GRANT EXECUTE ON FUNCTION public.debug_productie_columns() TO authenticated, anon;
