import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables ordered by dependency (parents first)
const SYNC_TABLES = [
  "app_settings",
  "gas_type_categories",
  "cylinder_sizes",
  "dry_ice_packaging",
  "dry_ice_product_types",
  "task_types",
  "time_off_types",
  "gas_types",
  "customers",
  "gas_cylinder_orders",
  "dry_ice_orders",
];

// FK columns to strip to avoid constraint errors on target
const STRIP_COLUMNS: Record<string, string[]> = {
  gas_types: ["category_id"],
  gas_cylinder_orders: ["customer_id", "gas_type_id", "assigned_to", "created_by"],
  dry_ice_orders: ["customer_id", "product_type_id", "packaging_id", "parent_order_id", "assigned_to", "created_by"],
};

function cleanRows(table: string, rows: any[]) {
  const cols = STRIP_COLUMNS[table];
  if (!cols) return rows;
  return rows.map((row) => {
    const clean = { ...row };
    for (const col of cols) delete clean[col];
    return clean;
  });
}

async function fetchAllRows(client: any, table: string) {
  const allRows: unknown[] = [];
  const batchSize = 999;
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(offset, offset + batchSize - 1);
    if (error) throw new Error(`Fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }
  return allRows;
}

async function upsertBatch(client: any, table: string, rows: any[]) {
  if (rows.length === 0) return { inserted: 0, errors: [] as string[] };
  const cleaned = cleanRows(table, rows);
  const batchSize = 200;
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < cleaned.length; i += batchSize) {
    const batch = cleaned.slice(i, i + batchSize);
    const { error } = await client.from(table).upsert(batch, { onConflict: "id", ignoreDuplicates: false });
    if (error) {
      errors.push(`batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const localServiceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await localServiceClient
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Alleen admins" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { direction, externalUrl, externalServiceKey, tables, tableIndex = 0, accumulatedResults = {} } = body;

    if (!externalUrl || !externalServiceKey) {
      return new Response(JSON.stringify({ error: "Externe Supabase URL en Service Role Key zijn vereist" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!direction || !["push", "pull"].includes(direction)) {
      return new Response(JSON.stringify({ error: "Richting moet 'push' of 'pull' zijn" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedTables: string[] = tables && tables.length > 0 ? tables : SYNC_TABLES;
    const externalClient = createClient(externalUrl, externalServiceKey);
    const sourceClient = direction === "push" ? localServiceClient : externalClient;
    const targetClient = direction === "push" ? externalClient : localServiceClient;

    // Process only ONE table per invocation to stay within CPU limits
    const currentTable = selectedTables[tableIndex];

    if (!currentTable) {
      // All tables done — return accumulated results
      const totalRows = Object.values(accumulatedResults as Record<string, any>).reduce((s: number, r: any) => s + r.rows, 0);
      const totalInserted = Object.values(accumulatedResults as Record<string, any>).reduce((s: number, r: any) => s + r.inserted, 0);
      const totalErrors = Object.values(accumulatedResults as Record<string, any>).reduce((s: number, r: any) => s + r.errors.length, 0);

      return new Response(JSON.stringify({
        success: true, direction, done: true,
        summary: { totalRows, totalInserted, totalErrors },
        details: accumulatedResults,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Process current table
    let tableResult: { rows: number; inserted: number; errors: string[] };
    try {
      const rows = await fetchAllRows(sourceClient, currentTable);
      const { inserted, errors } = await upsertBatch(targetClient, currentTable, rows);
      tableResult = { rows: rows.length, inserted, errors };
    } catch (error) {
      tableResult = { rows: 0, inserted: 0, errors: [error instanceof Error ? error.message : "Onbekende fout"] };
    }

    const newResults = { ...accumulatedResults, [currentTable]: tableResult };
    const nextIndex = tableIndex + 1;

    if (nextIndex < selectedTables.length) {
      // Return partial progress — frontend will chain the next call
      return new Response(JSON.stringify({
        success: true, direction, done: false,
        currentTable, tableIndex, nextIndex,
        totalTables: selectedTables.length,
        tableResult,
        accumulatedResults: newResults,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Last table — return final results
    const totalRows = Object.values(newResults as Record<string, any>).reduce((s: number, r: any) => s + r.rows, 0);
    const totalInserted = Object.values(newResults as Record<string, any>).reduce((s: number, r: any) => s + r.inserted, 0);
    const totalErrors = Object.values(newResults as Record<string, any>).reduce((s: number, r: any) => s + r.errors.length, 0);

    return new Response(JSON.stringify({
      success: true, direction, done: true,
      summary: { totalRows, totalInserted, totalErrors },
      details: newResults,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Sync mislukt" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
