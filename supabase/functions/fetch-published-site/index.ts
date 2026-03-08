import { getCorsHeaders } from "../_shared/cors.ts";

const ALLOWED_DOMAINS = [
  "planning.solnederland.nl",
  "planningsol.lovable.app",
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SSRF protection: validate URL against whitelist
    if (!isAllowedUrl(url)) {
      return new Response(JSON.stringify({ error: "URL niet toegestaan" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const isText = contentType.includes("text") || contentType.includes("json") || contentType.includes("javascript") || contentType.includes("css") || contentType.includes("svg") || contentType.includes("xml");

    if (isText) {
      const text = await response.text();
      return new Response(JSON.stringify({ content: text, contentType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const buffer = await response.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return new Response(JSON.stringify({ content: base64, contentType, binary: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
