import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get current date in Europe/Amsterdam timezone
    const now = new Date();
    const amsterdamDate = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
    const today = amsterdamDate.toISOString().split('T')[0];

    // Update all pending dry ice orders where scheduled_date is before today
    const { data, error, count } = await adminClient
      .from("dry_ice_orders")
      .update({ 
        status: "completed",
        updated_at: new Date().toISOString()
      })
      .eq("status", "pending")
      .lt("scheduled_date", today)
      .select("id");

    if (error) {
      console.error("Error updating dry ice orders:", error);
      throw error;
    }

    const updatedCount = data?.length || 0;
    console.log(`Updated ${updatedCount} dry ice orders from pending to completed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${updatedCount} orders bijgewerkt naar voltooid`,
        updatedCount,
        processedDate: today
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
    console.error("Error in complete-past-dry-ice-orders:", error);
    return new Response(
      JSON.stringify({ 
        error: "Fout bij bijwerken van orders", 
        details: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
