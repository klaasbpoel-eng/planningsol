import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10000;

const statusLabels: Record<string, string> = {
  pending: "Gepland",
  in_progress: "Bezig",
  completed: "Voltooid",
  cancelled: "Geannuleerd",
};

const gradeLabels: Record<string, string> = {
  medical: "Medicinaal",
  technical: "Technisch",
};

const locationLabels: Record<string, string> = {
  sol_emmen: "SOL Emmen",
  sol_tilburg: "SOL Tilburg",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user is authenticated and is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Check if user is admin
    const { data: roleCheck, error: roleError } = await userClient.rpc("is_admin");
    if (roleError || !roleCheck) {
      return new Response(JSON.stringify({ error: "Alleen admins kunnen exporteren" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to fetch all data
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional filters from query params
    const url = new URL(req.url);
    const locationFilter = url.searchParams.get("location");
    const yearFilter = url.searchParams.get("year");

    // Fetch gas types for name lookup
    const { data: gasTypes } = await adminClient
      .from("gas_types")
      .select("id, name");
    const gasTypeMap = new Map((gasTypes || []).map((gt: { id: string; name: string }) => [gt.id, gt.name]));

    // CSV header
    const BOM = "\uFEFF";
    const csvHeader = [
      "Ordernummer",
      "Klant",
      "Gastype",
      "Kwaliteit",
      "Cilindergrootte",
      "Aantal",
      "Druk (bar)",
      "Datum",
      "Status",
      "Locatie",
      "Opmerkingen",
    ].join(";");

    const csvRows: string[] = [csvHeader];

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let query = adminClient
        .from("gas_cylinder_orders")
        .select("order_number, customer_name, gas_type, gas_type_id, gas_grade, cylinder_size, cylinder_count, pressure, scheduled_date, status, location, notes")
        .order("scheduled_date", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (locationFilter) {
        query = query.eq("location", locationFilter);
      }
      if (yearFilter) {
        const year = parseInt(yearFilter);
        query = query
          .gte("scheduled_date", `${year}-01-01`)
          .lte("scheduled_date", `${year}-12-31`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching batch:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of data) {
        const gasTypeName = row.gas_type_id
          ? gasTypeMap.get(row.gas_type_id) || row.gas_type
          : row.gas_type;

        const csvRow = [
          row.order_number,
          row.customer_name,
          gasTypeName,
          gradeLabels[row.gas_grade] || row.gas_grade,
          row.cylinder_size,
          row.cylinder_count,
          row.pressure,
          row.scheduled_date,
          statusLabels[row.status] || row.status,
          locationLabels[row.location] || row.location,
          (row.notes || "").replace(/[\r\n;]/g, " "),
        ].join(";");

        csvRows.push(csvRow);
      }

      offset += data.length;

      if (data.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    const csvContent = BOM + csvRows.join("\r\n");

    const filename = `gascilinder-orders${yearFilter ? `-${yearFilter}` : ""}${locationFilter ? `-${locationFilter}` : ""}-${new Date().toISOString().split("T")[0]}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
    console.error("Error in export-cylinder-orders:", error);
    return new Response(
      JSON.stringify({ error: "Fout bij exporteren", details: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
