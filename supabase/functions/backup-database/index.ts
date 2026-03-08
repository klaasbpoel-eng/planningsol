import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const TABLES = [
  "gas_type_categories",
  "gas_types",
  "cylinder_sizes",
  "dry_ice_packaging",
  "dry_ice_product_types",
  "task_types",
  "time_off_types",
  "app_settings",
  "products",
  "stock_products",
  "gas_mixture_recipes",
  "customers",
  "customer_locations",
  "customer_products",
  "gas_cylinder_orders",
  "dry_ice_orders",
  "orders",
  "order_items",
  "internal_orders",
  "internal_order_items",
  "ambulance_trips",
  "ambulance_trip_customers",
  "toolboxes",
  "toolbox_sections",
  "toolbox_sessions",
  "toolbox_session_participants",
  "toolbox_completions",
  "tasks",
  "time_off_requests",
  "employee_leave_balances",
];

async function fetchAllRows(
  client: any,
  table: string
) {
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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Check admin role using the user's token
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

    // Check admin role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Alleen admins kunnen backups maken" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch all table data using service role client
    const tables: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      tables[table] = await fetchAllRows(serviceClient, table);
    }

    const backup = {
      version: "1.0",
      created_at: new Date().toISOString(),
      tables,
    };

    return new Response(JSON.stringify(backup), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error("Backup error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Backup mislukt",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
