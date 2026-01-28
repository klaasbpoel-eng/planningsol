import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CustomerRow {
  name: string;
  address: string;
  postalCode: string;
  city: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get CSV content from request body
    const { csvContent } = await req.json();
    
    if (!csvContent) {
      return new Response(
        JSON.stringify({ error: "No CSV content provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV - semicolon separated, with quotes
    const lines = csvContent.split("\n");
    const uniqueCustomers = new Map<string, CustomerRow>();

    // Skip header line (line 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by semicolon and remove quotes
      const columns = line.split(";").map((col: string) => col.replace(/^"|"$/g, "").trim());
      
      // Columns: 0=Debiteur_Faktuur, 1=Debiteur_Levering, 2=Debiteur_Levering_Naam, 
      // 3=Debiteur_Levering_Adres1, 4=Debiteur_Levering_Postcode, 5=Debiteur_Levering_Stad
      const debiteurLevering = columns[1];
      const name = columns[2];
      const address = columns[3];
      const postalCode = columns[4];
      const city = columns[5];

      if (name && debiteurLevering) {
        // Use Debiteur_Levering as unique key to avoid duplicates
        if (!uniqueCustomers.has(debiteurLevering)) {
          uniqueCustomers.set(debiteurLevering, {
            name,
            address: address || null,
            postalCode: postalCode || null,
            city: city || null,
          });
        }
      }
    }

    // Convert to array for insert
    const customersToInsert = Array.from(uniqueCustomers.values()).map((customer) => ({
      name: customer.name,
      address: customer.address 
        ? `${customer.address}, ${customer.postalCode} ${customer.city}`.trim()
        : null,
      is_active: true,
    }));

    console.log(`Found ${customersToInsert.length} unique customers to import`);

    // Insert in batches of 50 to avoid timeouts
    const batchSize = 50;
    let insertedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < customersToInsert.length; i += batchSize) {
      const batch = customersToInsert.slice(i, i + batchSize);
      
      // Insert each customer individually to handle duplicates gracefully
      for (const customer of batch) {
        // Check if customer with same name exists
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("name", customer.name)
          .maybeSingle();

        if (existing) {
          skippedCount++;
          continue;
        }

        const { error } = await supabase
          .from("customers")
          .insert(customer);

        if (error) {
          console.error(`Insert error for ${customer.name}:`, error);
          errors.push(`${customer.name}: ${error.message}`);
        } else {
          insertedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalParsed: uniqueCustomers.size,
        insertedCount,
        skippedCount,
        errorCount: errors.length,
        errors: errors.slice(0, 5), // Only return first 5 errors
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Import error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
