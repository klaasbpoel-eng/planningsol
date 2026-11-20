-- =============================================================================
-- AUTO TABLE CREATION RPC FOR SQL SYNC APP
-- Allows sql-sync-app to automatically create/update tables and columns in
-- Supabase from SQL query results over HTTPS (PostgREST RPC) even without a
-- direct PostgreSQL connection string.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ensure_sync_table(
    p_table_name text,
    p_columns jsonb,
    p_primary_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    col_item jsonb;
    col_name text;
    col_type text;
    pg_type text;
    has_id_col boolean := false;
    has_created_at_col boolean := false;
    col_defs text := '';
    pk_cols text[];
    pk_col text;
    quoted_pks text := '';
    constraint_name text;
BEGIN
    IF p_table_name IS NULL OR btrim(p_table_name) = '' THEN
        RAISE EXCEPTION 'Table name cannot be empty';
    END IF;

    FOR col_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_columns, '[]'::jsonb))
    LOOP
        col_name := btrim(col_item->>'name');
        IF lower(col_name) = 'id' THEN
            has_id_col := true;
        END IF;
        IF lower(col_name) = 'created_at' THEN
            has_created_at_col := true;
        END IF;
    END LOOP;

    IF NOT has_id_col THEN
        col_defs := 'id UUID DEFAULT gen_random_uuid() PRIMARY KEY';
    END IF;

    FOR col_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_columns, '[]'::jsonb))
    LOOP
        col_name := btrim(col_item->>'name');
        col_type := lower(COALESCE(col_item->>'type', 'string'));

        pg_type := CASE
            WHEN col_type IN ('integer', 'int', 'bigint') THEN 'NUMERIC'
            WHEN col_type IN ('float', 'number', 'decimal', 'numeric') THEN 'NUMERIC'
            WHEN col_type IN ('boolean', 'bool', 'bit') THEN 'BOOLEAN'
            WHEN col_type IN ('date', 'datetime', 'timestamp') THEN 'TIMESTAMP WITH TIME ZONE'
            WHEN col_type IN ('object', 'json', 'jsonb') THEN 'JSONB'
            WHEN col_type = 'uuid' THEN 'UUID'
            ELSE 'TEXT'
        END;

        IF col_defs <> '' THEN
            col_defs := col_defs || ', ';
        END IF;
        col_defs := col_defs || format('%I %s', col_name, pg_type);
    END LOOP;

    IF NOT has_created_at_col THEN
        IF col_defs <> '' THEN
            col_defs := col_defs || ', ';
        END IF;
        col_defs := col_defs || 'created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE(''utc''::text, NOW())';
    END IF;

    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (%s)', p_table_name, col_defs);

    -- Ensure all columns exist even if the table already existed
    FOR col_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_columns, '[]'::jsonb))
    LOOP
        col_name := btrim(col_item->>'name');
        col_type := lower(COALESCE(col_item->>'type', 'string'));

        pg_type := CASE
            WHEN col_type IN ('integer', 'int', 'bigint') THEN 'NUMERIC'
            WHEN col_type IN ('float', 'number', 'decimal', 'numeric') THEN 'NUMERIC'
            WHEN col_type IN ('boolean', 'bool', 'bit') THEN 'BOOLEAN'
            WHEN col_type IN ('date', 'datetime', 'timestamp') THEN 'TIMESTAMP WITH TIME ZONE'
            WHEN col_type IN ('object', 'json', 'jsonb') THEN 'JSONB'
            WHEN col_type = 'uuid' THEN 'UUID'
            ELSE 'TEXT'
        END;

        BEGIN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', p_table_name, col_name, pg_type);
        EXCEPTION WHEN others THEN
            NULL;
        END;
    END LOOP;

    -- Ensure unique constraint on primaryKey if specified
    IF p_primary_key IS NOT NULL AND btrim(p_primary_key) <> '' THEN
        pk_cols := string_to_array(p_primary_key, ',');
        FOREACH pk_col IN ARRAY pk_cols
        LOOP
            pk_col := btrim(pk_col);
            IF pk_col <> '' THEN
                IF quoted_pks <> '' THEN
                    quoted_pks := quoted_pks || ', ';
                END IF;
                quoted_pks := quoted_pks || format('%I', pk_col);
            END IF;
        END LOOP;

        IF quoted_pks <> '' THEN
            constraint_name := left(p_table_name || '_' || replace(replace(btrim(p_primary_key), ',', '_'), ' ', '') || '_unique_key', 63);
            BEGIN
                EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (%s)', p_table_name, constraint_name, quoted_pks);
            EXCEPTION WHEN duplicate_table OR duplicate_object OR others THEN
                NULL;
            END;
        END IF;
    END IF;

    -- Grants & RLS Policies
    EXECUTE format('GRANT ALL ON TABLE public.%I TO postgres, service_role', p_table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated', p_table_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_read_' || p_table_name, p_table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', 'authenticated_read_' || p_table_name, p_table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_read_' || p_table_name, p_table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)', 'anon_read_' || p_table_name, p_table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'service_role_all_' || p_table_name, p_table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', 'service_role_all_' || p_table_name, p_table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'sync_write_' || p_table_name, p_table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', 'sync_write_' || p_table_name, p_table_name);

    NOTIFY pgrst, 'reload schema';

    RETURN jsonb_build_object('success', true, 'table', p_table_name);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.ensure_sync_table(text, jsonb, text) TO anon, authenticated, service_role, postgres;

