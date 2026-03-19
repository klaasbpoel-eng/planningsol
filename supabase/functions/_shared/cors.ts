const ALLOWED_ORIGINS = [
  "https://planning.solnederland.nl",
  "https://planningsol.lovable.app",
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";

  // Allow exact matches and Lovable preview/project origins
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin) ||
    /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/.test(origin);

  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}
