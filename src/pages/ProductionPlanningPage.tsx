import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductionPlanning } from "@/components/production/ProductionPlanning";
import { PageTransition } from "@/components/ui/page-transition";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import type { User } from "@supabase/supabase-js";

const ProductionPlanningPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { role, permissions, loading: permissionsLoading, productionLocation, canViewAllLocations } = useUserPermissions(user?.id);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (!session?.user) {
          navigate("/");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <PageTransition>
      <div className="min-h-screen overflow-x-hidden">


        <main className="px-[1%] md:px-[10%] py-8 w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gradient">Productieplanning</h1>
            <p className="text-muted-foreground mt-1">
              Plan en beheer de productie van droogijs en gascilinders
            </p>
          </div>

          <ProductionPlanning
            userProductionLocation={productionLocation}
            canViewAllLocations={canViewAllLocations}
            permissions={permissions}
          />
        </main>
      </div>
    </PageTransition>
  );
};

export default ProductionPlanningPage;
