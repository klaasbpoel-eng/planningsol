
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const githubPat = Deno.env.get("GITHUB_PAT");

    if (!githubPat) {
       console.error("Missing GITHUB_PAT env variable");
       throw new Error("Server configuratie fout: GITHUB_PAT ontbreekt");
    }

    // Verify the user is authenticated and is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Check if user is admin
    const { data: roleCheck, error: roleError } = await userClient.rpc("is_admin");
    if (roleError || !roleCheck) {
      return new Response(JSON.stringify({ error: "Alleen admins kunnen deployen" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trigger GitHub Workflow
    // Using 'deploy-directadmin.yml' as the workflow filename
    console.log("Triggering GitHub Workflow...");
    const res = await fetch(
      "https://api.github.com/repos/klaasbpoel-eng/planningsol/actions/workflows/deploy-directadmin.yml/dispatches",
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${githubPat}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: "main", 
        }),
      }
    );

    if (!res.ok) {
        const errorText = await res.text();
        console.error("GitHub API Error:", res.status, errorText);
        throw new Error(`Fout bij communicatie met GitHub: ${res.status}`);
    }

    return new Response(JSON.stringify({ message: "Deployment succesvol gestart! Het kan enkele minuten duren." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in trigger-github-workflow:", error);
    return new Response(JSON.stringify({ error: error.message || "Interne server fout" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
