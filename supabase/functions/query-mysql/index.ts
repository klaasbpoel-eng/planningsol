import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import mysql from "https://esm.sh/mysql2@3.9.7/promise";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

        // Connect to MySQL
        const connection = await mysql.createConnection({
            host,
            port: port || 3306,
            user,
            password,
            database,
        });

        try {
            const [rows, fields] = await connection.execute(query, params || []);
            await connection.end();

            // Convert BigInt to string to avoid JSON serialization issues
            const result = JSON.parse(JSON.stringify(rows, (key, value) =>
                typeof value === "bigint" ? value.toString() : value
            ));

            return new Response(JSON.stringify({ data: result }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } catch (dbError) {
            await connection.end();
            throw dbError;
        }

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
