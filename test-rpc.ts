import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Testing RPC...");
  const { data, error } = await supabase.rpc("get_voorraad_met_afname");
  console.log("Error:", error);
  console.log("Data length:", data?.length);
  console.log("First 3 rows:");
  console.log(data?.slice(0, 3));
  
  const { count: vCount } = await supabase.from('voorraad').select('*', { count: 'exact', head: true });
  const { count: aCount } = await supabase.from('afname').select('*', { count: 'exact', head: true });
  console.log("Voorraad count:", vCount);
  console.log("Afname count:", aCount);
}
run();
