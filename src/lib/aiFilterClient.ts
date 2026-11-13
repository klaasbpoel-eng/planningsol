/** Asks Lovable AI (through the app's server function) to turn a plain-language request into a filter plan. */
import { supabase } from "@/integrations/supabase/client";
import type { AiFilterPlan } from "@/lib/aiFilters";
import type { DataColumn } from "@/lib/dataTable";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ramses-filter-ai`;

export async function requestFilterPlan(input: {
  question: string;
  columns: DataColumn[];
  samples: Record<string, string[]>;
  today: string;
  signal?: AbortSignal;
}): Promise<AiFilterPlan> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Je bent niet ingelogd.");
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      question: input.question,
      columns: input.columns.map(({ key, label, kind }) => ({ key, label, kind })),
      samples: input.samples,
      today: input.today,
    }),
    signal: input.signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "De AI kon je vraag nu niet verwerken.");
  if (!body || !Array.isArray(body.filters)) throw new Error("De AI gaf geen bruikbaar antwoord.");
  return body as AiFilterPlan;
}
