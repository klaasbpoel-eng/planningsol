import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYNC_TABLES = [
  "gas_type_categories",
  "gas_types",
  "cylinder_sizes",
  "dry_ice_packaging",
  "dry_ice_product_types",
  "task_types",
  "time_off_types",
  "app_settings",
  "customers",
  "gas_cylinder_orders",
  "dry_ice_orders",
];

async function fetchAllRows(client: any, table: string) {
  const allRows: unknown[] = [];
  const batchSize = 999;
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(`Error fetching ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  return allRows;
}

async function upsertBatch(client: any, table: string, rows: any[]) {
  if (rows.length === 0) return { inserted: 0, errors: [] };

  const batchSize = 500;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await client.from(table).upsert(batch, { onConflict: "id" });
    if (error) {
      errors.push(`${table} batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const localServiceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await localServiceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Alleen admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const body = await req.json();
    const { direction, externalUrl, externalServiceKey, tables } = body;

    if (!externalUrl || !externalServiceKey) {
      return new Response(JSON.stringify({ error: "Externe Supabase URL en Service Role Key zijn vereist" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!direction || !["push", "pull"].includes(direction)) {
      return new Response(JSON.stringify({ error: "Richting moet 'push' of 'pull' zijn" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedTables = tables && tables.length > 0 ? tables : SYNC_TABLES;
    const externalClient = createClient(externalUrl, externalServiceKey);

    const sourceClient = direction === "push" ? localServiceClient : externalClient;
    const targetClient = direction === "push" ? externalClient : localServiceClient;

    const results: Record<string, { rows: number; inserted: number; errors: string[] }> = {};

    for (const table of selectedTables) {
      try {
        const rows = await fetchAllRows(sourceClient, table);
        const { inserted, errors } = await upsertBatch(targetClient, table, rows);
        results[table] = { rows: rows.length, inserted, errors };
      } catch (error) {
        results[table] = {
          rows: 0,
          inserted: 0,
          errors: [error instanceof Error ? error.message : "Onbekende fout"],
        };
      }
    }

    const totalRows = Object.values(results).reduce((s, r) => s + r.rows, 0);
    const totalInserted = Object.values(results).reduce((s, r) => s + r.inserted, 0);
    const totalErrors = Object.values(results).reduce((s, r) => s + r.errors.length, 0);

    return new Response(
      JSON.stringify({
        success: true,
        direction,
        summary: { totalRows, totalInserted, totalErrors },
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Sync mislukt" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
