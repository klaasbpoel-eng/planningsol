import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Order matters: reference tables first, then dependent tables
const RESTORE_ORDER = [
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

// Delete in reverse: dependent tables first
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Alleen admins kunnen restores uitvoeren" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse and validate backup
    const backup = await req.json();

    if (!backup.version || !backup.tables) {
      return new Response(
        JSON.stringify({
          error:
            "Ongeldig backup-bestand: version en tables velden zijn vereist",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate that all expected tables exist in backup
    for (const table of RESTORE_ORDER) {
      if (!Array.isArray(backup.tables[table])) {
        return new Response(
          JSON.stringify({
            error: `Ongeldig backup-bestand: tabel "${table}" ontbreekt of is geen array`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Use direct SQL connection for transactional restore
    const sql = postgres(dbUrl, { max: 1 });

    try {
      await sql.begin(async (tx) => {
        // Delete in dependency order (children first)
        for (const table of DELETE_ORDER) {
          await tx.unsafe(`DELETE FROM public.${table}`);
        }

        // Insert in dependency order (parents first)
        for (const table of RESTORE_ORDER) {
          const rows = backup.tables[table];
          if (rows.length === 0) continue;

          const columns = Object.keys(rows[0]);
          const batchSize = 500;

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

            await tx.unsafe(
              `INSERT INTO public.${table} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES ${placeholders}`,
              values
            );
          }
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Database succesvol hersteld",
          stats: Object.fromEntries(
            RESTORE_ORDER.map((t) => [t, backup.tables[t].length])
          ),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
