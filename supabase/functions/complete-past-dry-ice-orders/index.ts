import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check: require valid Bearer token + admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get current date in Europe/Amsterdam timezone
    const now = new Date();
    const amsterdamDate = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
    const today = amsterdamDate.toISOString().split('T')[0];

    const { data, error, count } = await adminClient
      .from("dry_ice_orders")
      .select("id", { count: "exact" })
      .eq("status", "pending")
      .lt("scheduled_date", today);

    if (error) {
      console.error("Error querying dry ice orders:", error);
      throw error;
    }

    const overdueCount = count || 0;
    console.log(`Monitoring: ${overdueCount} openstaande droogijs-orders van voor ${today}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${overdueCount} openstaande orders gevonden`,
        overdueCount,
        processedDate: today
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const corsHeaders = getCorsHeaders(req);
    const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
    console.error("Error in complete-past-dry-ice-orders:", error);
    return new Response(
      JSON.stringify({ 
        error: "Fout bij controleren van orders", 
        details: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
