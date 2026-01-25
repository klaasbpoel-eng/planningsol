import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { ProductionPlanning } from "@/components/production/ProductionPlanning";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

const ProductionPlanningPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  if (loading) {
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
    <div className="min-h-screen gradient-mesh">
      <Header userEmail={user.email} />
      
      <main className="px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient">Productieplanning</h1>
          <p className="text-muted-foreground mt-1">
            Plan en beheer de productie van droogijs en gascilinders
          </p>
        </div>

        <ProductionPlanning />
      </main>
    </div>
  );
};

export default ProductionPlanningPage;
