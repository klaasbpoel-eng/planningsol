import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function sanitizeHost(raw: string): string {
    let h = raw.trim();
    h = h.replace(/^https?:\/\//i, "");
    h = h.replace(/\/.*$/, "");
    h = h.replace(/:\d+$/, "");
    return h;
}

Deno.serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);

    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Admin-only check
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const token = authHeader.replace("Bearer ", "");
        const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: isAdmin } = await userClient.rpc("is_admin");
        if (!isAdmin) {
            return new Response(JSON.stringify({ error: "Alleen admins kunnen SQL queries uitvoeren" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
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
