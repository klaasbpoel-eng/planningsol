import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""
);

async function checkDates() {
  const { data, error } = await supabase
    .from("Productie")
    .select("Datum, Aantal, Locatie, Product, Jaar");

  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Total entries:", data.length);
  const sampleDates = data.slice(0, 10).map(d => `${d.Datum} (${d.Jaar})`);
  console.log("Samples:", sampleDates);
  
}

checkDates();
