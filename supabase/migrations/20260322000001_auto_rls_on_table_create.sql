-- =============================================================================
-- AUTO RLS SETUP: event trigger + restore functie voor ERP tabellen
--
-- Probleem: wanneer een tabel wordt verwijderd en opnieuw aangemaakt (bv. bij
-- ERP-sync), gaan alle RLS-policies verloren. PostgREST blokkeert dan alle
-- rijen voor de 'authenticated' rol.
--
-- Oplossing:
--   1. restore_erp_table_policies()  → handmatig aanroepen via supabase.rpc()
--   2. auto_setup_new_table_rls()    → event trigger, vuurt op elke CREATE TABLE
-- =============================================================================

-- ── 1. Helper: pas RLS + basisbeleid toe op één tabel ────────────────────────
CREATE OR REPLACE FUNCTION public.setup_table_read_policy(p_schema text, p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_id  text := format('%I.%I', p_schema, p_table);
  pol_name text := 'authenticated_read_' || p_table;
BEGIN
  -- RLS inschakelen
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', full_id);

  -- Policy (her)aanmaken
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol_name, full_id);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR SELECT TO authenticated USING (true)',
    pol_name, full_id
  );
END;
$$;

-- ── 2. Event trigger functie: vuurt op CREATE TABLE ──────────────────────────
CREATE OR REPLACE FUNCTION public.auto_setup_new_table_rls()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    -- Gebruik object_identity direct (bevat al juiste quoting, bv. public."Voorraad")
    BEGIN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);

      EXECUTE format(
        'CREATE POLICY %I ON %s FOR SELECT TO authenticated USING (true)',
        'authenticated_read_' || obj.object_name,
        obj.object_identity
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL; -- policy bestaat al, skip
      WHEN others THEN NULL;           -- andere fout (system table e.d.), skip
    END;
  END LOOP;
END;
$$;

-- Event trigger registreren (vervang bestaande als die er is)
DROP EVENT TRIGGER IF EXISTS auto_rls_setup_on_create;
CREATE EVENT TRIGGER auto_rls_setup_on_create
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.auto_setup_new_table_rls();

-- ── 3. Handmatige restore: herstel policies op bekende ERP-tabellen ──────────
CREATE OR REPLACE FUNCTION public.restore_erp_table_policies()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Voeg hier tabelnamen toe als er ERP-tabellen bijkomen
  erp_tables text[] := ARRAY[
    'Voorraad',
    'Afname'
  ];
  tbl    text;
  result text := '';
BEGIN
  FOREACH tbl IN ARRAY erp_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      PERFORM public.setup_table_read_policy('public', tbl);
      result := result || tbl || ': OK' || E'\n';
    ELSE
      result := result || tbl || ': tabel niet gevonden' || E'\n';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- Grants zodat de app de restore functie kan aanroepen
GRANT EXECUTE ON FUNCTION public.restore_erp_table_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.setup_table_read_policy(text, text) TO postgres;
