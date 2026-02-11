import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { OrderHistory } from "@/components/customer-portal/OrderHistory";
import { PageTransition } from "@/components/ui/page-transition";
import { Loader2 } from "lucide-react";
import { AuthForm } from "@/components/auth/AuthForm";
import type { User } from "@supabase/supabase-js";

const CustomerOrderHistoryPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <PageTransition>
        <AuthForm />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Header userEmail={user.email} role="customer" />
        <main className="w-full px-[2%] md:px-[5%] py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Mijn Bestellingen</h1>
            <p className="text-muted-foreground">Overzicht van al je geplaatste bestellingen.</p>
          </div>
          <OrderHistory userId={user.id} />
        </main>
      </div>
    </PageTransition>
  );
};

export default CustomerOrderHistoryPage;
