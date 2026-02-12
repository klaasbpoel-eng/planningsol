import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarOverview } from "@/components/calendar/CalendarOverview";
import { PageTransition } from "@/components/ui/page-transition";
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
    <PageTransition>
      <div className="min-h-screen flex flex-col overflow-x-hidden">
        <main className="flex-1 flex flex-col w-full px-[1%] md:px-[10%]">
          <CalendarOverview currentUser={user} />
        </main>
      </div>
    </PageTransition>
  );
};

export default CalendarPage;
