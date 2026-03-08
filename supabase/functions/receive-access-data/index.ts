import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const webhookSecret = Deno.env.get("ACCESS_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");

    if (!webhookSecret) {
      throw new Error("ACCESS_WEBHOOK_SECRET not configured");
    }

    if (providedSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { table_name, rows, id_field } = body;

    if (!table_name || !Array.isArray(rows)) {
      throw new Error("Missing 'table_name' (string) or 'rows' (array)");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const idKey = id_field || "ID";
    let upsertedCount = 0;

    // Process in batches of 500
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const records = batch.map((row: Record<string, unknown>) => ({
        table_name,
        external_id: row[idKey] != null ? String(row[idKey]) : null,
        row_data: row,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("access_sync_data")
        .upsert(records, { onConflict: "table_name,external_id" });

      if (error) throw error;
      upsertedCount += batch.length;
    }

    // Log the sync
    const sourceIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    await supabase.from("access_sync_log").insert({
      table_name,
      rows_received: rows.length,
      rows_upserted: upsertedCount,
      status: "success",
      source_ip: sourceIp,
    });

    return new Response(
      JSON.stringify({ success: true, table_name, rows_upserted: upsertedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Try to log the error
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("access_sync_log").insert({
        table_name: "unknown",
        rows_received: 0,
        rows_upserted: 0,
        status: "error",
        error_message: (error as Error).message,
      });
    } catch (_) { /* ignore logging errors */ }

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
