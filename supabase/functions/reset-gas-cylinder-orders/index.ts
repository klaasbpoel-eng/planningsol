import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const dropAndRecreateSql = `
      DROP TABLE IF EXISTS public.gas_cylinder_orders CASCADE;

      CREATE TABLE public.gas_cylinder_orders (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        order_number text NOT NULL,
        customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
        customer_name text NOT NULL,
        gas_type public.gas_type NOT NULL DEFAULT 'co2'::gas_type,
        gas_type_id uuid REFERENCES public.gas_types(id) ON DELETE SET NULL,
        gas_grade public.gas_grade NOT NULL DEFAULT 'technical'::gas_grade,
        cylinder_size text NOT NULL DEFAULT 'medium'::text,
        cylinder_count integer NOT NULL,
        pressure integer NOT NULL DEFAULT 200,
        status public.production_order_status NOT NULL DEFAULT 'pending'::production_order_status,
        location public.production_location NOT NULL DEFAULT 'sol_emmen'::production_location,
        scheduled_date date NOT NULL,
        series_id uuid,
        notes text,
        created_by uuid NOT NULL REFERENCES public.profiles(id),
        assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );

      ALTER TABLE public.gas_cylinder_orders ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Admins can view all gas cylinder orders" ON public.gas_cylinder_orders FOR SELECT USING (is_admin());
      CREATE POLICY "Admins can create gas cylinder orders" ON public.gas_cylinder_orders FOR INSERT WITH CHECK (is_admin());
      CREATE POLICY "Admins can update gas cylinder orders" ON public.gas_cylinder_orders FOR UPDATE USING (is_admin());
      CREATE POLICY "Admins can delete gas cylinder orders" ON public.gas_cylinder_orders FOR DELETE USING (is_admin());

      CREATE POLICY "Users can view assigned or created gas cylinder orders" ON public.gas_cylinder_orders FOR SELECT
        USING (created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

      CREATE POLICY "Operators can view gas cylinder orders at their location" ON public.gas_cylinder_orders FOR SELECT
        USING (has_role(auth.uid(), 'operator'::app_role) AND ((get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid())) OR get_user_production_location(auth.uid()) IS NULL));
      CREATE POLICY "Operators can create gas cylinder orders at their location" ON public.gas_cylinder_orders FOR INSERT
        WITH CHECK (has_role(auth.uid(), 'operator'::app_role) AND ((get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid())) OR get_user_production_location(auth.uid()) IS NULL));
      CREATE POLICY "Operators can update gas cylinder orders at their location" ON public.gas_cylinder_orders FOR UPDATE
        USING (has_role(auth.uid(), 'operator'::app_role) AND ((get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid())) OR get_user_production_location(auth.uid()) IS NULL));
      CREATE POLICY "Operators can delete gas cylinder orders at their location" ON public.gas_cylinder_orders FOR DELETE
        USING (has_role(auth.uid(), 'operator'::app_role) AND ((get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid())) OR get_user_production_location(auth.uid()) IS NULL));

      CREATE POLICY "Supervisors can view gas cylinder orders at their location" ON public.gas_cylinder_orders FOR SELECT
        USING (has_role(auth.uid(), 'supervisor'::app_role) AND ((get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid())) OR get_user_production_location(auth.uid()) IS NULL));
      CREATE POLICY "Supervisors can create gas cylinder orders at their location" ON public.gas_cylinder_orders FOR INSERT
        WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role) AND ((get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid())) OR get_user_production_location(auth.uid()) IS NULL));
      CREATE POLICY "Supervisors can update gas cylinder orders at their location" ON public.gas_cylinder_orders FOR UPDATE
        USING (has_role(auth.uid(), 'supervisor'::app_role) AND ((get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid())) OR get_user_production_location(auth.uid()) IS NULL));
      CREATE POLICY "Supervisors can delete gas cylinder orders at their location" ON public.gas_cylinder_orders FOR DELETE
        USING (has_role(auth.uid(), 'supervisor'::app_role) AND ((get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid())) OR get_user_production_location(auth.uid()) IS NULL));

      CREATE INDEX idx_gas_cylinder_orders_scheduled_date ON public.gas_cylinder_orders(scheduled_date);
      CREATE INDEX idx_gas_cylinder_orders_status ON public.gas_cylinder_orders(status);
      CREATE INDEX idx_gas_cylinder_orders_location ON public.gas_cylinder_orders(location);
      CREATE INDEX idx_gas_cylinder_orders_customer_id ON public.gas_cylinder_orders(customer_id);
      CREATE INDEX idx_gas_cylinder_orders_created_by ON public.gas_cylinder_orders(created_by);
      CREATE INDEX idx_gas_cylinder_orders_gas_type_id ON public.gas_cylinder_orders(gas_type_id);

      CREATE TRIGGER update_gas_cylinder_orders_updated_at BEFORE UPDATE ON public.gas_cylinder_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    `;

    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("Database URL niet geconfigureerd");

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
      JSON.stringify({ success: true, message: "Tabel gas_cylinder_orders is succesvol verwijderd en opnieuw aangemaakt" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
    console.error("Error resetting gas_cylinder_orders:", error);
    return new Response(
      JSON.stringify({ error: "Fout bij resetten van tabel", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
