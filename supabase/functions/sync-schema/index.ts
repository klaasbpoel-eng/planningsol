import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ENUM_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dry_ice_product_type') THEN
    CREATE TYPE dry_ice_product_type AS ENUM ('blocks', 'pellets', 'sticks');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_order_status') THEN
    CREATE TYPE production_order_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_location') THEN
    CREATE TYPE production_location AS ENUM ('sol_emmen', 'sol_tilburg');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gas_type') THEN
    CREATE TYPE gas_type AS ENUM ('co2', 'nitrogen', 'argon', 'acetylene', 'oxygen', 'helium', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gas_grade') THEN
    CREATE TYPE gas_grade AS ENUM ('medical', 'technical');
  END IF;
END $$;
`;

const TABLE_SQLS: { name: string; sql: string }[] = [
  {
    name: "app_settings",
    sql: `CREATE TABLE IF NOT EXISTS public.app_settings (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      key text NOT NULL,
      value text,
      description text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "gas_type_categories",
    sql: `CREATE TABLE IF NOT EXISTS public.gas_type_categories (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      description text,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "cylinder_sizes",
    sql: `CREATE TABLE IF NOT EXISTS public.cylinder_sizes (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      description text,
      capacity_liters numeric,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "dry_ice_packaging",
    sql: `CREATE TABLE IF NOT EXISTS public.dry_ice_packaging (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      description text,
      capacity_kg numeric,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "dry_ice_product_types",
    sql: `CREATE TABLE IF NOT EXISTS public.dry_ice_product_types (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      description text,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "task_types",
    sql: `CREATE TABLE IF NOT EXISTS public.task_types (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      description text,
      color text NOT NULL DEFAULT '#06b6d4',
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      parent_id uuid REFERENCES public.task_types(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "time_off_types",
    sql: `CREATE TABLE IF NOT EXISTS public.time_off_types (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      description text,
      color text NOT NULL DEFAULT '#3b82f6',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "gas_types",
    sql: `CREATE TABLE IF NOT EXISTS public.gas_types (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      description text,
      color text NOT NULL DEFAULT '#3b82f6',
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      category_id uuid REFERENCES public.gas_type_categories(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "customers",
    sql: `CREATE TABLE IF NOT EXISTS public.customers (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      contact_person text,
      email text,
      phone text,
      address text,
      notes text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "gas_cylinder_orders",
    sql: `CREATE TABLE IF NOT EXISTS public.gas_cylinder_orders (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      order_number text NOT NULL,
      customer_name text NOT NULL,
      customer_id uuid REFERENCES public.customers(id),
      gas_type gas_type NOT NULL DEFAULT 'co2',
      gas_type_id uuid REFERENCES public.gas_types(id),
      gas_grade gas_grade NOT NULL DEFAULT 'technical',
      cylinder_size text NOT NULL DEFAULT 'medium',
      cylinder_count integer NOT NULL,
      pressure integer NOT NULL DEFAULT 200,
      status production_order_status NOT NULL DEFAULT 'pending',
      location production_location NOT NULL DEFAULT 'sol_emmen',
      scheduled_date date NOT NULL,
      notes text,
      created_by uuid,
      assigned_to uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "dry_ice_orders",
    sql: `CREATE TABLE IF NOT EXISTS public.dry_ice_orders (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      order_number text NOT NULL,
      customer_name text NOT NULL,
      customer_id uuid REFERENCES public.customers(id),
      product_type dry_ice_product_type NOT NULL DEFAULT 'blocks',
      product_type_id uuid REFERENCES public.dry_ice_product_types(id),
      packaging_id uuid REFERENCES public.dry_ice_packaging(id),
      quantity_kg numeric NOT NULL,
      box_count integer,
      container_has_wheels boolean,
      status production_order_status NOT NULL DEFAULT 'pending',
      location production_location NOT NULL DEFAULT 'sol_emmen',
      scheduled_date date NOT NULL,
      is_recurring boolean DEFAULT false,
      parent_order_id uuid REFERENCES public.dry_ice_orders(id),
      recurrence_end_date date,
      notes text,
      created_by uuid,
      assigned_to uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin check
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Alleen admins kunnen schema aanmaken" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { externalDbUrl, tables } = await req.json();

    if (!externalDbUrl) {
      return new Response(
        JSON.stringify({ error: "Externe Database URL is vereist" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sql = postgres(externalDbUrl, { max: 1, idle_timeout: 10 });

    const results: { name: string; status: "created" | "exists" | "error"; error?: string }[] = [];

    try {
      // 1. Create enums
      await sql.unsafe(ENUM_SQL);
      results.push({ name: "enums", status: "created" });
    } catch (e) {
      results.push({ name: "enums", status: "error", error: e.message });
    }

    // 2. Create tables
    const selectedTables = tables && tables.length > 0
      ? TABLE_SQLS.filter((t) => tables.includes(t.name))
      : TABLE_SQLS;

    for (const table of selectedTables) {
      try {
        await sql.unsafe(table.sql);
        results.push({ name: table.name, status: "created" });
      } catch (e) {
        results.push({ name: table.name, status: "error", error: e.message });
      }
    }

    await sql.end();

    const errors = results.filter((r) => r.status === "error");

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        results,
        summary: {
          total: results.length,
          created: results.filter((r) => r.status === "created").length,
          errors: errors.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
