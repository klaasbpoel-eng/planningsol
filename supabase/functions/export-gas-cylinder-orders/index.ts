import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 10000;

const locationLabels: Record<string, string> = {
  sol_emmen: "SOL Emmen",
  sol_tilburg: "SOL Tilburg",
};

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

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user is authenticated using anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client to bypass RLS
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get total count
    const { count, error: countError } = await serviceClient
      .from("gas_cylinder_orders")
      .select("*", { count: "exact", head: true });

    if (countError) {
      throw new Error(`Count error: ${countError.message}`);
    }

    const totalRows = count || 0;
    console.log(`Exporting ${totalRows} gas cylinder orders`);

    // Fetch all gas types for name lookup
    const { data: gasTypes } = await serviceClient
      .from("gas_types")
      .select("id, name");
    const gasTypeMap = new Map((gasTypes || []).map((gt) => [gt.id, gt.name]));

    // CSV header with BOM for Excel UTF-8 support
    const BOM = "\uFEFF";
    const header = [
      "Locatie",
      "Ordernummer",
      "Klant",
      "Gastype",
      "Kwaliteit",
      "Aantal Cilinders",
      "Cilindergrootte",
      "Druk (bar)",
      "Datum",
      "Status",
      "Opmerkingen",
    ].join(",");

    const csvParts: string[] = [BOM, header, "\n"];

    // Fetch in batches
    for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
      const { data, error } = await serviceClient
        .from("gas_cylinder_orders")
        .select("*")
        .order("scheduled_date", { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        throw new Error(`Fetch error at offset ${offset}: ${error.message}`);
      }

      if (!data || data.length === 0) break;

      for (const row of data) {
        const gasTypeName = row.gas_type_id
          ? gasTypeMap.get(row.gas_type_id) || row.gas_type
          : row.gas_type;

        const line = [
          escapeCSV(locationLabels[row.location] || row.location),
          escapeCSV(row.order_number),
          escapeCSV(row.customer_name),
          escapeCSV(gasTypeName),
          escapeCSV(gradeLabels[row.gas_grade] || row.gas_grade),
          escapeCSV(row.cylinder_count),
          escapeCSV(row.cylinder_size),
          escapeCSV(row.pressure),
          escapeCSV(row.scheduled_date),
          escapeCSV(statusLabels[row.status] || row.status),
          escapeCSV(row.notes),
        ].join(",");

        csvParts.push(line, "\n");
      }

      console.log(`Processed ${Math.min(offset + BATCH_SIZE, totalRows)}/${totalRows} rows`);
    }

    const csvContent = csvParts.join("");

    const today = new Date().toISOString().split("T")[0];
    const filename = `gascilinder-orders-export-${today}.csv`;

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: "Er ging iets mis bij het exporteren" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
