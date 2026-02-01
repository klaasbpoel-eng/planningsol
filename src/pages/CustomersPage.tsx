import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { CustomerManagement } from "@/components/customers/CustomerManagement";
import { AuthForm } from "@/components/auth/AuthForm";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Navigate } from "react-router-dom";

export default function CustomersPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { role, isAdmin, loading: permissionsLoading } = useUserPermissions(session?.user?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <AuthForm />;
  }

  // Redirect non-admins to home page
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header userEmail={session.user.email} isAdmin={isAdmin} role={role} />
      <main className="container mx-auto px-4 py-6">
        <CustomerManagement isAdmin={isAdmin} />
      </main>
    </div>
  );
}
