// Lovable AI: turns a plain-language request on the Ramses-correcties page into filter conditions.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createFilterPlan, PlanError, type PlanColumn, type PlanInput } from "../_shared/ramses-filter-plan.ts";
import { getLovableAiGatewayResponseHeaders } from "../_shared/run-id.ts";

// The app signs users in against this project, so tokens are checked there (publishable key, safe in code).
const APP_AUTH_URL = "https://sbngjpnvxwwlchenyhhy.supabase.co";
const APP_AUTH_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibmdqcG52eHd3bGNoZW55aGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjQwNzQsImV4cCI6MjA4ODMwMDA3NH0.WLt_Sx3cALHTO5qy0A17i3SjsDzz6pgW8sa3mbiQA_c";

const KINDS = new Set(["text", "number", "date", "boolean"]);
const MAX_QUESTION = 500;
const MAX_COLUMNS = 60;

function parseInput(body: unknown): PlanInput | string {
  const b = body as Record<string, unknown> | null;
  const question = typeof b?.question === "string" ? b.question.trim() : "";
  if (!question) return "Beschrijf eerst welke regels je zoekt.";
  if (question.length > MAX_QUESTION) return `Houd je vraag korter dan ${MAX_QUESTION} tekens.`;
  const columns: PlanColumn[] = (Array.isArray(b?.columns) ? b!.columns : [])
    .slice(0, MAX_COLUMNS)
    .filter((c: any) => typeof c?.key === "string" && c.key && typeof c?.label === "string" && KINDS.has(c?.kind))
    .map((c: any) => ({ key: c.key.slice(0, 100), label: c.label.slice(0, 100), kind: c.kind }));
  if (columns.length === 0) return "Er zijn nog geen kolommen geladen.";
  const samples: Record<string, string[]> = {};
  const rawSamples = (b?.samples ?? {}) as Record<string, unknown>;
  for (const col of columns) {
    const list = rawSamples[col.key];
    if (Array.isArray(list)) samples[col.key] = list.filter((v) => typeof v === "string").slice(0, 20).map((v) => v.slice(0, 80));
  }
  const today = typeof b?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : new Date().toISOString().slice(0, 10);
  return { question, columns, samples, today };
}

Deno.serve(async (req) => {
  const corsHeaders = {
    ...getCorsHeaders(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Alleen POST is toegestaan." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Je bent niet ingelogd." }, 401);

  // Only signed-in admins may use this, the same people who may open the page.
  const appClient = createClient(APP_AUTH_URL, APP_AUTH_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await appClient.auth.getUser(authHeader.slice(7));
  if (userError || !userData?.user) return json({ error: "Je bent niet ingelogd." }, 401);
  const { data: roleRow } = await appClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "Alleen beheerders kunnen dit gebruiken." }, 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ongeldig verzoek." }, 400);
  }
  const input = parseInput(body);
  if (typeof input === "string") return json({ error: input }, 400);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "De AI is niet goed ingesteld (sleutel ontbreekt)." }, 500);

  try {
    const plan = await createFilterPlan(req, apiKey, input);
    return new Response(JSON.stringify(plan), {
      headers: getLovableAiGatewayResponseHeaders(undefined, { ...corsHeaders, "Content-Type": "application/json" }),
    });
  } catch (error) {
    if (error instanceof PlanError) return json({ error: error.message }, error.status);
    console.error("ramses-filter-ai", error);
    return json({ error: "De AI kon je vraag nu niet verwerken. Probeer het later opnieuw." }, 500);
  }
});
