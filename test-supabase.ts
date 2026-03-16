
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const supabase = createClient(process.env.VITE_SUPABASE_URL || "", process.env.VITE_SUPABASE_ANON_KEY || "");

async function main() {
  console.log("Fetching all time_off_requests...");
  const { data, error } = await supabase.from("time_off_requests").select("*");
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Total entries:", data.length);
    console.log(JSON.stringify(data, null, 2));
  }
}

main();

