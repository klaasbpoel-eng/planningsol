import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ParsedProduct {
  articleCode: string;
  name: string;
  category: string | null;
  sizeLiters: number | null;
}

interface CustomerProductLink {
  customerName: string;
  articleCode: string;
  warehouse: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent } = await req.json();
    
    if (!csvContent) {
      return new Response(
        JSON.stringify({ error: "No CSV content provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV - semicolon separated, with quotes
    const lines = csvContent.split("\n");
    const uniqueProducts = new Map<string, ParsedProduct>();
    const customerProductLinks: CustomerProductLink[] = [];

    // Skip header line (line 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by semicolon and remove quotes
      const columns = line.split(";").map((col: string) => col.replace(/^"|"$/g, "").trim());
      
      // Columns: 10=ArtikelCode, 11=ArtikelOmschrijving, 12=Magazijn
      // Also: 2=Debiteur_Levering_Naam
      const customerName = columns[2];
      const articleCode = columns[10];
      const articleDescription = columns[11];
      const warehouse = columns[12];

      if (articleCode && articleDescription) {
        // Extract size from description like "Stikstof 4.8 (50L)" -> 50
        const sizeMatch = articleDescription.match(/\((\d+)L?\)/i);
        const sizeLiters = sizeMatch ? parseInt(sizeMatch[1]) : null;

        // Extract category from description
        let category = "Gas";
        if (articleDescription.toLowerCase().includes("zuurstof")) category = "Zuurstof";
        else if (articleDescription.toLowerCase().includes("stikstof")) category = "Stikstof";
        else if (articleDescription.toLowerCase().includes("argon")) category = "Argon";
        else if (articleDescription.toLowerCase().includes("acetyleen")) category = "Acetyleen";
        else if (articleDescription.toLowerCase().includes("helium")) category = "Helium";
        else if (articleDescription.toLowerCase().includes("weldmix")) category = "Weldmix";
        else if (articleDescription.toLowerCase().includes("propaan")) category = "Propaan";
        else if (articleDescription.toLowerCase().includes("kooldioxide") || articleDescription.toLowerCase().includes("co2")) category = "CO2";
        else if (articleDescription.toLowerCase().includes("formeergas")) category = "Formeergas";

        if (!uniqueProducts.has(articleCode)) {
          uniqueProducts.set(articleCode, {
            articleCode,
            name: articleDescription,
            category,
            sizeLiters,
          });
        }

        // Track customer-product link
        if (customerName) {
          customerProductLinks.push({
            customerName,
            articleCode,
            warehouse: warehouse || null,
          });
        }
      }
    }

    // Insert products
    const productsToInsert = Array.from(uniqueProducts.values()).map((p) => ({
      article_code: p.articleCode,
      name: p.name,
      category: p.category,
      size_liters: p.sizeLiters,
      is_active: true,
    }));

    console.log(`Found ${productsToInsert.length} unique products to import`);

    let insertedProducts = 0;
    let skippedProducts = 0;

    for (const product of productsToInsert) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("article_code", product.article_code)
        .maybeSingle();

      if (existing) {
        skippedProducts++;
        continue;
      }

      const { error } = await supabase
        .from("products")
        .insert(product);

      if (error) {
        console.error(`Insert error for ${product.article_code}:`, error);
      } else {
        insertedProducts++;
      }
    }

    // Now link customers to products
    // First get all products and customers
    const { data: products } = await supabase
      .from("products")
      .select("id, article_code");
    
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name");

    const productMap = new Map(products?.map(p => [p.article_code, p.id]) || []);
    const customerMap = new Map(customers?.map(c => [c.name, c.id]) || []);

    // Get unique customer-product combinations
    const uniqueLinks = new Map<string, CustomerProductLink>();
    for (const link of customerProductLinks) {
      const key = `${link.customerName}|${link.articleCode}`;
      if (!uniqueLinks.has(key)) {
        uniqueLinks.set(key, link);
      }
    }

    let linkedCount = 0;
    for (const link of uniqueLinks.values()) {
      const customerId = customerMap.get(link.customerName);
      const productId = productMap.get(link.articleCode);

      if (customerId && productId) {
        // Check if link exists
        const { data: existing } = await supabase
          .from("customer_products")
          .select("id")
          .eq("customer_id", customerId)
          .eq("product_id", productId)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase
            .from("customer_products")
            .insert({
              customer_id: customerId,
              product_id: productId,
              warehouse: link.warehouse,
            });

          if (!error) {
            linkedCount++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        productsFound: uniqueProducts.size,
        productsInserted: insertedProducts,
        productsSkipped: skippedProducts,
        customerProductLinks: linkedCount,
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
