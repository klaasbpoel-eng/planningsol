import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_TABLES = [
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

// Delete in reverse dependency order
const DELETE_ORDER = [
  "gas_cylinder_orders",
  "dry_ice_orders",
  "customers",
  "app_settings",
  "time_off_types",
  "task_types",
  "dry_ice_product_types",
  "dry_ice_packaging",
  "cylinder_sizes",
  "gas_types",
  "gas_type_categories",
];

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Unauthorized");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: roleData } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) throw new Error("Alleen admins kunnen restores uitvoeren");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await verifyAdmin(req);

    const body = await req.json();
    const { action } = body;

    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
    const sql = postgres(dbUrl, { max: 1 });

    try {
      if (action === "clear") {
        // Delete all data in reverse dependency order
        for (const table of DELETE_ORDER) {
          await sql.unsafe(`DELETE FROM public.${table}`);
        }
        return new Response(
          JSON.stringify({ success: true, message: "Alle tabellen geleegd" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "insert") {
        const { table, rows } = body;

        if (!VALID_TABLES.includes(table)) {
          return new Response(
            JSON.stringify({ error: `Ongeldige tabel: ${table}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!Array.isArray(rows) || rows.length === 0) {
          return new Response(
            JSON.stringify({ success: true, inserted: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const columns = Object.keys(rows[0]);
        const batchSize = 500;

        let totalInserted = 0;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const placeholders = batch
            .map(
              (_: unknown, rowIdx: number) =>
                `(${columns.map((_: string, colIdx: number) => `$${rowIdx * columns.length + colIdx + 1}`).join(", ")})`
            )
            .join(", ");

          const values = batch.flatMap((row: Record<string, unknown>) =>
            columns.map((col) => row[col] ?? null)
          );

          await sql.unsafe(
            `INSERT INTO public.${table} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES ${placeholders}`,
            values
          );
          totalInserted += batch.length;
        }

        return new Response(
          JSON.stringify({ success: true, inserted: totalInserted }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Ongeldige actie. Gebruik 'clear' of 'insert'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      await sql.end();
    }
  } catch (error) {
    console.error("Restore error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Restore mislukt",
      }),
      {
        status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
