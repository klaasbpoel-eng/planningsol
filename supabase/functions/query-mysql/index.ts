import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sanitizeHost(raw: string): string {
    let h = raw.trim();
    h = h.replace(/^https?:\/\//i, "");
    h = h.replace(/\/.*$/, "");
    h = h.replace(/:\d+$/, "");
    return h;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            throw new Error("Missing or invalid Authorization header");
        }

        const { host, port, user, password, database, query, params } = await req.json();

        if (!host || !user || !password || !database || !query) {
            throw new Error("Missing connection details or query");
        }

        const client = await new Client().connect({
            hostname: sanitizeHost(host),
            port: port || 3306,
            username: user,
            password,
            db: database,
        });

        try {
            const result = await client.execute(query, params || []);
            await client.close();

            return new Response(JSON.stringify({ data: result.rows || [] }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } catch (dbError) {
            await client.close();
            throw dbError;
        }

    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
