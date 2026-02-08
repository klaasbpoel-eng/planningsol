import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Alleen admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mysqlHost, mysqlPort, mysqlUser, mysqlPassword, mysqlDatabase } = await req.json();

    if (!mysqlHost || !mysqlUser || !mysqlDatabase) {
      return new Response(
        JSON.stringify({ error: "MySQL host, user en database zijn vereist" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startTime = Date.now();

    const client = await new Client().connect({
      hostname: mysqlHost,
      port: parseInt(mysqlPort || "3306"),
      username: mysqlUser,
      password: mysqlPassword,
      db: mysqlDatabase,
    });

    // Run a simple query to verify the connection works
    const { rows } = await client.execute("SELECT VERSION() as version");
    const version = rows?.[0]?.version ?? "onbekend";

    // Check which sync tables already exist
    const { rows: tableRows } = await client.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
      [mysqlDatabase]
    );
    const existingTables = (tableRows || []).map((r: any) => r.TABLE_NAME || r.table_name);

    await client.close();

    const elapsed = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        version,
        latency_ms: elapsed,
        existing_tables: existingTables,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
