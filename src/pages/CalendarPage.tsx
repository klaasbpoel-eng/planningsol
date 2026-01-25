import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { CalendarOverview } from "@/components/calendar/CalendarOverview";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

const CalendarPage = () => {
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header userEmail={user.email} />
      
      <main className="px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Verlofkalender</h1>
          <p className="text-muted-foreground mt-1">
            Bekijk al uw geplande verlof in verschillende weergaven
          </p>
        </div>

        <CalendarOverview />
      </main>
    </div>
  );
};

export default CalendarPage;
