import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to check role
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin using service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Alleen admins kunnen deze actie uitvoeren" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute the drop and recreate using raw SQL via service role
    const dropAndRecreateSql = `
      -- Drop the existing table (cascades to policies, indexes, triggers)
      DROP TABLE IF EXISTS public.dry_ice_orders CASCADE;

      -- Recreate the table
      CREATE TABLE public.dry_ice_orders (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        order_number text NOT NULL,
        customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
        customer_name text NOT NULL,
        product_type public.dry_ice_product_type NOT NULL DEFAULT 'blocks'::dry_ice_product_type,
        product_type_id uuid REFERENCES public.dry_ice_product_types(id) ON DELETE SET NULL,
        packaging_id uuid REFERENCES public.dry_ice_packaging(id) ON DELETE SET NULL,
        quantity_kg numeric NOT NULL,
        box_count integer,
        container_has_wheels boolean,
        status public.production_order_status NOT NULL DEFAULT 'pending'::production_order_status,
        location public.production_location NOT NULL DEFAULT 'sol_emmen'::production_location,
        scheduled_date date NOT NULL,
        is_recurring boolean DEFAULT false,
        recurrence_end_date date,
        parent_order_id uuid REFERENCES public.dry_ice_orders(id) ON DELETE SET NULL,
        notes text,
        created_by uuid NOT NULL REFERENCES public.profiles(id),
        assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );

      -- Enable RLS
      ALTER TABLE public.dry_ice_orders ENABLE ROW LEVEL SECURITY;

      -- Admin policies
      CREATE POLICY "Admins can view all dry ice orders"
        ON public.dry_ice_orders FOR SELECT
        USING (is_admin());

      CREATE POLICY "Admins can create dry ice orders"
        ON public.dry_ice_orders FOR INSERT
        WITH CHECK (is_admin());

      CREATE POLICY "Admins can update dry ice orders"
        ON public.dry_ice_orders FOR UPDATE
        USING (is_admin());

      CREATE POLICY "Admins can delete dry ice orders"
        ON public.dry_ice_orders FOR DELETE
        USING (is_admin());

      -- User policy for viewing assigned/created orders
      CREATE POLICY "Users can view assigned or created dry ice orders"
        ON public.dry_ice_orders FOR SELECT
        USING (
          created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
          OR assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        );

      -- Supervisor policy
      CREATE POLICY "Supervisors can view dry ice orders at their location"
        ON public.dry_ice_orders FOR SELECT
        USING (
          has_role(auth.uid(), 'supervisor'::app_role)
          AND (
            (get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid()))
            OR get_user_production_location(auth.uid()) IS NULL
          )
        );

      -- Operator policy
      CREATE POLICY "Operators can view dry ice orders at their location"
        ON public.dry_ice_orders FOR SELECT
        USING (
          has_role(auth.uid(), 'operator'::app_role)
          AND (
            (get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid()))
            OR get_user_production_location(auth.uid()) IS NULL
          )
        );

      -- Create indexes for performance
      CREATE INDEX idx_dry_ice_orders_scheduled_date ON public.dry_ice_orders(scheduled_date);
      CREATE INDEX idx_dry_ice_orders_status ON public.dry_ice_orders(status);
      CREATE INDEX idx_dry_ice_orders_location ON public.dry_ice_orders(location);
      CREATE INDEX idx_dry_ice_orders_customer_id ON public.dry_ice_orders(customer_id);
      CREATE INDEX idx_dry_ice_orders_created_by ON public.dry_ice_orders(created_by);
      CREATE INDEX idx_dry_ice_orders_product_type_id ON public.dry_ice_orders(product_type_id);
      CREATE INDEX idx_dry_ice_orders_packaging_id ON public.dry_ice_orders(packaging_id);
      CREATE INDEX idx_dry_ice_orders_parent_order_id ON public.dry_ice_orders(parent_order_id);

      -- Add updated_at trigger
      CREATE TRIGGER update_dry_ice_orders_updated_at
        BEFORE UPDATE ON public.dry_ice_orders
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    `;

    // Use pg directly via the database URL
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      throw new Error("Database URL niet geconfigureerd");
    }

    // Import postgres
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.4/mod.js");
    const sql = postgres(dbUrl);

    try {
      await sql.unsafe(dropAndRecreateSql);
      await sql.end();
    } catch (dbError) {
      await sql.end();
      throw dbError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Tabel dry_ice_orders is succesvol verwijderd en opnieuw aangemaakt" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
    console.error("Error resetting dry_ice_orders:", error);
    return new Response(
      JSON.stringify({ 
        error: "Fout bij resetten van tabel", 
        details: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
