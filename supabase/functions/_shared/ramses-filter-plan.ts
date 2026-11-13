// Turns a plain-language question about the Ramses corrections into filter conditions, via Lovable AI.
import { createOpenAI } from "npm:@ai-sdk/openai@4";
import { NoObjectGeneratedError, Output, streamText } from "npm:ai@7";
import { z } from "npm:zod@4";

import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./run-id.ts";

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const FILTER_MODEL = "openai/gpt-6-astra";

export interface PlanColumn {
  key: string;
  label: string;
  kind: "text" | "number" | "date" | "boolean";
}

export interface PlanInput {
  question: string;
  columns: PlanColumn[];
  /** A few example values per column key, so names and codes can be matched. */
  samples: Record<string, string[]>;
  /** Today's date (yyyy-mm-dd) in the user's time zone, for words like "vorige week". */
  today: string;
}

export const OPERATORS = ["contains", "equals", "one_of", "gt", "gte", "lt", "lte"] as const;

function planSchema(columnKeys: string[]) {
  return z
    .object({
      filters: z.array(
        z
          .object({
            column: z.enum(columnKeys as [string, ...string[]]),
            operator: z.enum(OPERATORS),
            value: z.string().nullable(),
            values: z.array(z.string()),
          })
          .strict(),
      ),
      explanation: z.string(),
    })
    .strict();
}

export type FilterPlan = z.infer<ReturnType<typeof planSchema>>;

const INSTRUCTIONS = `Je zet een vraag in gewone taal (meestal Nederlands) om in filters voor een tabel met correcties uit het systeem Ramses.
Regels:
- Gebruik alleen de kolommen uit de lijst; kies de kolom die het best bij de vraag past (let op naam én voorbeeldwaarden).
- Alle filters gelden tegelijk (EN).
- operator "contains": tekstkolom bevat de waarde (hoofdletters maken niet uit). Gebruik dit voor namen en stukken tekst.
- operator "equals": exact gelijk. Voor ja/nee-kolommen value "true" of "false".
- operator "one_of": de kolom is een van de waarden in "values" (gebruik de exacte schrijfwijze uit de voorbeelden als die er is).
- operators "gt", "gte", "lt", "lte": groter dan, minimaal, kleiner dan, maximaal; alleen voor getal- en datumkolommen.
- Getallen schrijf je met een punt als decimaalteken en zonder duizendtallen, bijv. "1234.5".
- Datums schrijf je als jjjj-mm-dd. Een periode wordt "gte" begin en "lt" de dag ná het einde. Voorbeeld "in oktober 2026": gte 2026-10-01 en lt 2026-11-01. "Op 3 november": gte 2026-11-03 en lt 2026-11-04.
- Bij datumvragen zonder kolomnaam kies je de belangrijkste datumkolom (vaak dt_dn).
- Zet "value" op null als je "values" gebruikt, en "values" op [] als je "value" gebruikt.
- Kun je (een deel van) de vraag niet vertalen naar deze kolommen, laat dat deel weg.
- "explanation": één korte zin in het Nederlands die zegt welke regels nu getoond worden, of waarom je niets kon filteren.`;

function describeColumns(input: PlanInput) {
  return input.columns
    .map((col) => {
      const examples = (input.samples[col.key] ?? []).slice(0, 20).map((v) => JSON.stringify(v)).join(", ");
      return `- ${col.key} (naam op scherm: "${col.label}", soort: ${col.kind})${examples ? `; voorbeelden: ${examples}` : ""}`;
    })
    .join("\n");
}

export class PlanError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function statusOf(error: unknown): number | undefined {
  const e = error as { statusCode?: number; status?: number; cause?: unknown } | undefined;
  return e?.statusCode ?? e?.status ?? (e?.cause ? statusOf(e.cause) : undefined);
}

function toPlanError(error: unknown): PlanError {
  const status = statusOf(error);
  if (status === 402) return new PlanError("Het AI-tegoed is op. Vul het tegoed aan bij Settings → Plans & credits.", 402);
  if (status === 429) return new PlanError("Het is even te druk voor de AI. Probeer het over een minuut opnieuw.", 429);
  if (status === 403) return new PlanError("De AI is voor deze werkruimte niet beschikbaar. Een beheerder moet dit controleren.", 403);
  if (status === 401) return new PlanError("De AI is niet goed ingesteld (sleutel ontbreekt).", 500);
  if (error instanceof Error && error.name === "AbortError") return new PlanError("Verzoek afgebroken.", 499);
  return new PlanError("De AI kon je vraag nu niet verwerken. Probeer het later opnieuw.", status && status >= 500 ? 502 : 500);
}

export async function createFilterPlan(request: Request, apiKey: string, input: PlanInput): Promise<FilterPlan> {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  let streamError: unknown;
  const result = streamText({
    model: provider.responses(FILTER_MODEL),
    instructions: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: `Vandaag is ${input.today}.\n\nKolommen:\n${describeColumns(input)}\n\nVraag: ${input.question}`,
      },
    ],
    output: Output.object({ schema: planSchema(input.columns.map((c) => c.key)) }),
    abortSignal: request.signal,
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  try {
    // Drain the stream so errors surface, then read the typed result.
    await result.consumeStream();
    if (streamError) throw streamError;
    return (await result.output) as FilterPlan;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new PlanError("De AI gaf geen bruikbaar antwoord. Probeer je vraag anders te stellen.", 502);
    }
    throw toPlanError(streamError ?? error);
  }
}
