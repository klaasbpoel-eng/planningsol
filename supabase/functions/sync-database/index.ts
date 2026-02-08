import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Fetch a single page of rows
async function fetchPage(client: any, table: string, offset: number, limit: number) {
  const { data, error } = await client
    .from(table)
    .select("*")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`Fetch ${table}: ${error.message}`);
  return data || [];
}

// Upsert a single batch
async function upsertBatch(client: any, table: string, rows: any[]) {
  if (rows.length === 0) return { inserted: 0, error: null as string | null };
  const cleaned = cleanRows(table, rows);
  const { error } = await client.from(table).upsert(cleaned, { onConflict: "id", ignoreDuplicates: false });
  if (error) return { inserted: 0, error: error.message };
  return { inserted: cleaned.length, error: null };
}

const BATCH_SIZE = 500; // rows per call

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
    const {
      direction,
      externalUrl,
      externalServiceKey,
      tables,
      // Pagination state
      tableIndex = 0,
      batchOffset = 0,
      // Accumulated results across all calls
      accumulatedResults = {},
      // Current table accumulator
      currentTableRows = 0,
      currentTableInserted = 0,
      currentTableErrors = [] as string[],
    } = body;

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

    // All tables done?
    if (tableIndex >= selectedTables.length) {
      const totalRows = Object.values(accumulatedResults as Record<string, any>).reduce((s: number, r: any) => s + r.rows, 0);
      const totalInserted = Object.values(accumulatedResults as Record<string, any>).reduce((s: number, r: any) => s + r.inserted, 0);
      const totalErrors = Object.values(accumulatedResults as Record<string, any>).reduce((s: number, r: any) => s + r.errors.length, 0);
      return new Response(JSON.stringify({
        success: true, direction, done: true,
        summary: { totalRows, totalInserted, totalErrors },
        details: accumulatedResults,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const currentTable = selectedTables[tableIndex];

    // Fetch one batch from source
    let rows: any[] = [];
    let fetchError: string | null = null;
    try {
      rows = await fetchPage(sourceClient, currentTable, batchOffset, BATCH_SIZE);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "Fetch fout";
    }

    let newTableRows = currentTableRows;
    let newTableInserted = currentTableInserted;
    let newTableErrors = [...currentTableErrors];

    if (fetchError) {
      newTableErrors.push(fetchError);
    } else if (rows.length > 0) {
      newTableRows += rows.length;
      const result = await upsertBatch(targetClient, currentTable, rows);
      newTableInserted += result.inserted;
      if (result.error) newTableErrors.push(`offset ${batchOffset}: ${result.error}`);
    }

    // More rows to fetch for this table?
    const hasMore = !fetchError && rows.length === BATCH_SIZE;

    if (hasMore) {
      // Continue with next batch of same table
      return new Response(JSON.stringify({
        success: true, direction, done: false,
        tableIndex, batchOffset: batchOffset + BATCH_SIZE,
        currentTable,
        totalTables: selectedTables.length,
        currentTableRows: newTableRows,
        currentTableInserted: newTableInserted,
        currentTableErrors: newTableErrors,
        accumulatedResults,
        progress: {
          table: currentTable,
          tableNum: tableIndex + 1,
          totalTables: selectedTables.length,
          rowsProcessed: newTableRows,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Table complete — save result and move to next
    const newResults = {
      ...accumulatedResults,
      [currentTable]: { rows: newTableRows, inserted: newTableInserted, errors: newTableErrors },
    };
    const nextIndex = tableIndex + 1;

    if (nextIndex >= selectedTables.length) {
      // All done
      const totalRows = Object.values(newResults as Record<string, any>).reduce((s: number, r: any) => s + r.rows, 0);
      const totalInserted = Object.values(newResults as Record<string, any>).reduce((s: number, r: any) => s + r.inserted, 0);
      const totalErrors = Object.values(newResults as Record<string, any>).reduce((s: number, r: any) => s + r.errors.length, 0);
      return new Response(JSON.stringify({
        success: true, direction, done: true,
        summary: { totalRows, totalInserted, totalErrors },
        details: newResults,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Next table
    return new Response(JSON.stringify({
      success: true, direction, done: false,
      tableIndex: nextIndex, batchOffset: 0,
      currentTable: selectedTables[nextIndex],
      totalTables: selectedTables.length,
      currentTableRows: 0,
      currentTableInserted: 0,
      currentTableErrors: [],
      accumulatedResults: newResults,
      progress: {
        table: selectedTables[nextIndex],
        tableNum: nextIndex + 1,
        totalTables: selectedTables.length,
        rowsProcessed: 0,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Sync mislukt" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
